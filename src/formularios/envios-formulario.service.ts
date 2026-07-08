import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ColaEnviosService } from '../cola/cola-envios.service';
import { JornadasService } from '../jornadas/jornadas.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { EnviarFormularioDto } from './dto/formulario.dto';
import {
  RespuestaDetalleRespuestaDto,
  RespuestaEnvioFormularioDto,
} from './dto/respuesta-formulario.dto';
import { CampoFormulario } from './entities/campo-formulario.entity';
import { EnvioFormulario } from './entities/envio-formulario.entity';
import { PlantillaFormulario } from './entities/plantilla-formulario.entity';
import { RespuestaFormulario } from './entities/respuesta-formulario.entity';
import { TipoCampo } from './enums/tipo-campo.enum';
import {
  aRespuestaDetalle,
  aRespuestaEnvio,
} from './utils/serializar-formulario';

interface RespuestaEntrada {
  claveCampo: string;
  valor: unknown;
}

@Injectable()
export class EnviosFormularioService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PlantillaFormulario)
    private readonly plantillaRepository: Repository<PlantillaFormulario>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
    @InjectRepository(RespuestaFormulario)
    private readonly respuestaRepository: Repository<RespuestaFormulario>,
    private readonly jornadasService: JornadasService,
    private readonly colaEnviosService: ColaEnviosService,
  ) {}

  async enviar(
    dto: EnviarFormularioDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaEnvioFormularioDto> {
    if (dto.jornadaId) {
      await this.jornadasService.obtenerUna(dto.jornadaId);
    }

    const plantilla = await this.plantillaRepository.findOne({
      where: { id: dto.plantillaFormularioId },
      relations: { campos: true },
    });

    if (!plantilla) {
      throw new NotFoundException(
        `Plantilla ${dto.plantillaFormularioId} no encontrada`,
      );
    }

    if (!plantilla.estaActivo) {
      throw new BadRequestException('La plantilla no está publicada');
    }

    this.validarCamposObligatorios(
      plantilla.campos ?? [],
      dto.respuestas as RespuestaEntrada[],
    );

    const ahora = new Date();

    const envioGuardado = await this.dataSource.transaction(async (manager) => {
      const envio = manager.create(EnvioFormulario, {
        enviadoEn: ahora,
        sincronizadoEn: ahora,
        esOffline: false,
        datosRaw: { respuestas: dto.respuestas, usuarioId: usuarioActual.id },
        jornada: dto.jornadaId ? { id: dto.jornadaId } : null,
        usuario: { id: usuarioActual.id },
        plantillaFormulario: { id: dto.plantillaFormularioId },
      });

      const guardado = await manager.save(EnvioFormulario, envio);

      for (const entrada of dto.respuestas) {
        const campo = plantilla.campos?.find(
          (c) => c.clave === entrada.claveCampo,
        );

        if (!campo) {
          continue;
        }

        const respuesta = this.mapearRespuesta(
          manager,
          guardado.id,
          campo,
          entrada.valor,
        );

        await manager.save(RespuestaFormulario, respuesta);
      }

      return guardado;
    });

    if (dto.jornadaId) {
      await this.colaEnviosService.encolarProcesarEnvio({
        envioId: envioGuardado.id,
        jornadaId: dto.jornadaId,
      });
    }

    return aRespuestaEnvio(envioGuardado);
  }

  async listarPorJornada(
    jornadaId: string,
  ): Promise<RespuestaEnvioFormularioDto[]> {
    await this.jornadasService.obtenerUna(jornadaId);

    const envios = await this.envioRepository.find({
      where: { jornada: { id: jornadaId } },
      order: { enviadoEn: 'DESC' },
    });

    return envios.map((e) => aRespuestaEnvio(e));
  }

  async obtenerRespuestas(
    envioId: string,
  ): Promise<RespuestaDetalleRespuestaDto[]> {
    const respuestas = await this.respuestaRepository.find({
      where: { envioFormulario: { id: envioId } },
      relations: { campoFormulario: true },
    });

    if (!respuestas.length) {
      const envio = await this.envioRepository.findOne({
        where: { id: envioId },
      });

      if (!envio) {
        throw new NotFoundException(`Envío ${envioId} no encontrado`);
      }

      return [];
    }

    const detalle = respuestas.map((r) => ({
      id: r.id,
      claveCampo: r.claveCampo,
      etiquetaCampo: r.campoFormulario?.etiqueta ?? r.claveCampo,
      valorTexto: r.valorTexto,
      valorNumero: r.valorNumero != null ? Number(r.valorNumero) : undefined,
      valorFecha: r.valorFecha,
      valorBooleano: r.valorBooleano,
      valorJson: r.valorJson ?? undefined,
      urlArchivo: r.urlArchivo,
    }));

    return aRespuestaDetalle(detalle);
  }

  private validarCamposObligatorios(
    campos: CampoFormulario[],
    respuestas: RespuestaEntrada[],
  ): void {
    const mapaRespuestas = new Map(
      respuestas.map((r) => [r.claveCampo, r.valor]),
    );

    for (const campo of campos.filter((c) => c.esObligatorio)) {
      const valor = mapaRespuestas.get(campo.clave);

      if (valor === undefined || valor === null || valor === '') {
        throw new BadRequestException(
          `El campo obligatorio "${campo.etiqueta}" (${campo.clave}) no fue completado`,
        );
      }
    }
  }

  private mapearRespuesta(
    manager: EntityManager,
    envioId: string,
    campo: CampoFormulario,
    valor: unknown,
  ): RespuestaFormulario {
    const base = {
      claveCampo: campo.clave,
      envioFormulario: { id: envioId },
      campoFormulario: { id: campo.id },
    };

    switch (campo.tipoCampo) {
      case TipoCampo.NUMERO:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorNumero: Number(valor),
        });
      case TipoCampo.FECHA:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorFecha: new Date(String(valor)),
        });
      case TipoCampo.SI_NO:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorBooleano: Boolean(valor),
        });
      case TipoCampo.GPS:
      case TipoCampo.SELECCION_MULTIPLE:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorJson:
            typeof valor === 'object'
              ? (valor as Record<string, unknown>)
              : { valor },
        });
      case TipoCampo.FOTO:
      case TipoCampo.FIRMA:
      case TipoCampo.ARCHIVO:
        return manager.create(RespuestaFormulario, {
          ...base,
          urlArchivo: String(valor),
        });
      default:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorTexto: String(valor),
        });
    }
  }
}
