import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { CampoBeneficiario } from '../beneficiarios/entities/campo-beneficiario.entity';
import type { DatosAdicionales } from '../beneficiarios/entities/campo-beneficiario.entity';
import { HistorialDatoBeneficiario } from '../beneficiarios/entities/historial-dato-beneficiario.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import {
  DESTINO_VEREDA_PDET,
  claveExtra,
  esDestinoExtra,
  etiquetaDestino,
  leerVinculo,
  PREFIJO_DESTINO,
  tipoDeDestino,
  valorParaDestino,
} from '../formularios/utils/vinculo-beneficiario';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { esLineaBase } from '../jornadas/utils/fase-jornada';
import { LineasProductivasService } from '../lineas-productivas/lineas-productivas.service';
import { VeredaPdet } from '../territorios/entities/vereda-pdet.entity';

export interface ResultadoAplicacionLineaBase {
  beneficiarioId: string | null;
  cambios: number;
}

/** Valor comparable para decidir si hubo cambio y para guardarlo en el historial. */
function comparable(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (valor === undefined || valor === '') return null;
  return valor;
}

/**
 * Lleva al beneficiario las respuestas de las preguntas vinculadas de una
 * jornada de línea base. Se ejecuta dentro de la transacción de aprobación
 * (o de "subir al proyecto" cuando la jornada no requiere revisión).
 *
 * - Solo escribe si la respuesta trae un valor válido y distinto del actual.
 * - Cada cambio deja una fila en `historial_datos_beneficiario` con el valor
 *   anterior y el nuevo.
 * - Las preguntas no vinculadas no se tocan: quedan como respuestas de la
 *   jornada (respuestas de línea base del beneficiario en ese proyecto).
 */
@Injectable()
export class AplicacionLineaBaseService {
  private readonly logger = new Logger(AplicacionLineaBaseService.name);

  constructor(
    private readonly lineasProductivasService: LineasProductivasService,
  ) {}

  async aplicar(
    manager: EntityManager,
    jornadaId: string,
    usuarioId: string,
  ): Promise<ResultadoAplicacionLineaBase> {
    const jornada = await manager.findOne(Jornada, {
      where: { id: jornadaId },
      relations: { proyecto: true, plantillaFormulario: true },
    });
    if (!jornada || !esLineaBase(jornada)) {
      return { beneficiarioId: null, cambios: 0 };
    }

    const [envio, beneficiarioJornada] = await Promise.all([
      manager.findOne(EnvioFormulario, {
        where: {
          jornada: { id: jornadaId },
          ...(jornada.plantillaFormulario
            ? { plantillaFormulario: { id: jornada.plantillaFormulario.id } }
            : {}),
        },
        relations: { beneficiario: true },
        order: { enviadoEn: 'DESC' },
      }),
      manager
        .createQueryBuilder(Beneficiario, 'b')
        .innerJoin('jornada_beneficiarios', 'jb', 'jb.beneficiario_id = b.id')
        .where('jb.jornada_id = :jornadaId', { jornadaId })
        .getOne(),
    ]);

    const beneficiarioId = envio?.beneficiario?.id ?? beneficiarioJornada?.id;
    if (!envio || !beneficiarioId) {
      this.logger.warn(
        `Jornada de línea base ${jornadaId} aprobada sin envío o sin beneficiario: no se actualiza la ficha`,
      );
      return { beneficiarioId: beneficiarioId ?? null, cambios: 0 };
    }

    const [respuestas, beneficiario, adicionales] = await Promise.all([
      manager.find(RespuestaFormulario, {
        where: { envioFormulario: { id: envio.id } },
        relations: { campoFormulario: true },
      }),
      manager.findOne(Beneficiario, {
        where: { id: beneficiarioId },
        relations: { veredaPdet: true },
      }),
      manager.find(CampoBeneficiario, { where: { proyecto: IsNull() } }),
    ]);
    if (!beneficiario) return { beneficiarioId, cambios: 0 };

    const tipos = new Map(adicionales.map((c) => [c.clave, c.tipo]));
    const etiquetas = new Map(adicionales.map((c) => [c.clave, c.etiqueta]));

    const parcial: Record<string, unknown> = {};
    let datosAdicionales: DatosAdicionales | null = null;
    const historial: Array<Partial<HistorialDatoBeneficiario>> = [];

    for (const respuesta of respuestas) {
      const campo = respuesta.campoFormulario;
      const vinculo = leerVinculo(campo?.vincularBeneficiario);
      if (!campo || !vinculo) continue;

      const tipoDestino = tipoDeDestino(vinculo.destino, tipos);
      if (!tipoDestino) continue;
      const valor = valorParaDestino(
        vinculo.destino,
        tipoDestino,
        campo.tipoCampo,
        respuesta,
      );
      if (!valor) continue;

      const registrar = (antes: unknown, despues: unknown) =>
        historial.push({
          beneficiario: { id: beneficiario.id } as Beneficiario,
          proyecto: { id: jornada.proyecto.id } as Jornada['proyecto'],
          jornadaId,
          envioFormularioId: envio.id,
          campo: vinculo.destino,
          etiqueta: etiquetaDestino(vinculo.destino, etiquetas),
          valorAnterior: comparable(antes),
          valorNuevo: comparable(despues),
          origen: 'LINEA_BASE',
          usuario: { id: usuarioId } as HistorialDatoBeneficiario['usuario'],
        });

      if (valor.tipo === 'vereda_pdet') {
        if (vinculo.destino !== DESTINO_VEREDA_PDET) continue;
        if (beneficiario.veredaPdet?.id === valor.veredaPdetId) continue;
        const vereda = await manager.findOne(VeredaPdet, {
          where: { id: valor.veredaPdetId },
        });
        if (!vereda) continue;
        registrar(beneficiario.veredaPdet?.nombre ?? null, vereda.nombre);
        parcial.veredaPdet = { id: vereda.id };
        continue;
      }

      if (esDestinoExtra(vinculo.destino)) {
        const clave = claveExtra(vinculo.destino);
        datosAdicionales ??= { ...(beneficiario.datosAdicionales ?? {}) };
        const antes = datosAdicionales[clave] ?? null;
        if (comparable(antes) === comparable(valor.valor)) continue;
        registrar(antes, valor.valor);
        datosAdicionales[clave] = valor.valor;
        continue;
      }

      const campoFicha = vinculo.destino.slice(
        PREFIJO_DESTINO.length,
      ) as keyof Beneficiario;
      const antes = (beneficiario as unknown as Record<string, unknown>)[
        campoFicha
      ];
      if (comparable(antes) === comparable(valor.valor)) continue;

      if (campoFicha === 'lineaProductiva') {
        const linea = await this.lineasProductivasService.asegurar(
          String(valor.valor),
          manager,
        );
        if (!linea) continue;
        if (beneficiario.lineaProductivaId === linea.id) continue;
        registrar(antes, linea.nombre);
        parcial.lineaProductiva = linea.nombre;
        parcial.lineaProductivaId = linea.id;
        continue;
      }

      registrar(antes, valor.valor);
      parcial[campoFicha] = valor.valor;
    }

    if (datosAdicionales) parcial.datosAdicionales = datosAdicionales;
    if (!historial.length) return { beneficiarioId, cambios: 0 };

    await manager.update(
      Beneficiario,
      beneficiario.id,
      parcial as QueryDeepPartialEntity<Beneficiario>,
    );
    await manager.save(
      HistorialDatoBeneficiario,
      historial.map((fila) => manager.create(HistorialDatoBeneficiario, fila)),
    );
    return { beneficiarioId, cambios: historial.length };
  }
}
