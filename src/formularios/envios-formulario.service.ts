import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../common/workflow/accion-auditoria.enum';
import { ColaEnviosService } from '../cola/cola-envios.service';
import {
  CronologiaService,
  detalleConOrigen,
} from '../cronologia/cronologia.service';
import { estadoEditable } from '../common/workflow/maquina-estados';
import { JornadasService } from '../jornadas/jornadas.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  EnviarFormularioDto,
  ActualizarEnvioFormularioDto,
  CorregirEnvioFormularioDto,
} from './dto/formulario.dto';
import { AutocompletadoFormularioService } from './autocompletado-formulario.service';
import {
  aplicarAutocompletado,
  type CampoConAutocompletado,
} from './utils/autocompletado';
import {
  RespuestaDetalleRespuestaDto,
  RespuestaEnvioFormularioDto,
  RespuestaEnvioPrevioDto,
} from './dto/respuesta-formulario.dto';
import { CampoFormulario } from './entities/campo-formulario.entity';
import { EnvioFormulario } from './entities/envio-formulario.entity';
import { PlantillaFormulario } from './entities/plantilla-formulario.entity';
import { RespuestaFormulario } from './entities/respuesta-formulario.entity';
import { TipoCampo } from './enums/tipo-campo.enum';
import { TipoPlantilla } from './enums/tipo-plantilla.enum';
import {
  aRespuestaDetalle,
  aRespuestaEnvio,
  aRespuestaEnvioPrevio,
} from './utils/serializar-formulario';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { TipoJornada } from '../jornadas/enums/tipo-jornada.enum';

interface RespuestaEntrada {
  claveCampo: string;
  valor: unknown;
}

function corregidasDe(envio: EnvioFormulario): string[] {
  const lista = (envio.datosRaw as { corregidasPorAdmin?: unknown } | null)
    ?.corregidasPorAdmin;
  return Array.isArray(lista)
    ? lista.filter((c): c is string => typeof c === 'string')
    : [];
}

/** Valor de una respuesta en forma simple, para comparar y auditar cambios. */
function valorComparable(respuesta: RespuestaFormulario): unknown {
  return (
    respuesta.valorJson ??
    (respuesta.valorFecha instanceof Date
      ? respuesta.valorFecha.toISOString().slice(0, 10)
      : respuesta.valorFecha) ??
    (respuesta.valorNumero != null ? Number(respuesta.valorNumero) : null) ??
    respuesta.valorBooleano ??
    respuesta.urlArchivo ??
    respuesta.valorTexto ??
    null
  );
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
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    private readonly jornadasService: JornadasService,
    private readonly colaEnviosService: ColaEnviosService,
    private readonly cronologiaService: CronologiaService,
    private readonly autocompletadoService: AutocompletadoFormularioService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  /**
   * Reemplaza con la ficha del beneficiario las respuestas autocompletadas: el
   * técnico no las puede cambiar, así que el valor final lo pone el servidor.
   */
  private async aplicarFicha(opciones: {
    plantilla: PlantillaFormulario;
    jornadaId?: string | null;
    beneficiarioId?: string | null;
    respuestas: RespuestaEntrada[];
    corregidasPorAdmin?: string[];
  }) {
    const campos = (opciones.plantilla.campos ?? []) as CampoConAutocompletado[];
    const contexto = await this.autocompletadoService.contextoEnvio({
      jornadaId: opciones.jornadaId,
      tipoPlantilla: opciones.plantilla.tipoPlantilla,
      campos,
      beneficiarioId: opciones.beneficiarioId,
      corregidasPorAdmin: opciones.corregidasPorAdmin,
    });
    const { respuestas, registro } = aplicarAutocompletado(
      campos,
      opciones.respuestas,
      contexto,
    );
    return { respuestas, registro, beneficiarioId: contexto.beneficiarioId };
  }

  async enviar(
    dto: EnviarFormularioDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaEnvioFormularioDto> {
    if (dto.jornadaId) {
      await this.jornadasService.obtenerUna(dto.jornadaId);
      await this.asegurarJornadaEditableParaCaptura(dto.jornadaId);
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

    const indiceFila = dto.indiceFila ?? 0;
    const conFicha = await this.aplicarFicha({
      plantilla,
      jornadaId: dto.jornadaId,
      beneficiarioId: dto.beneficiarioId,
      respuestas: dto.respuestas as RespuestaEntrada[],
    });

    this.validarCamposObligatorios(plantilla.campos ?? [], conFicha.respuestas);

    if (dto.jornadaId) {
      // Un envío por jornada, plantilla y persona (sin persona: el envío único de siempre).
      const existente = await this.envioRepository.findOne({
        where: {
          jornada: { id: dto.jornadaId },
          plantillaFormulario: { id: dto.plantillaFormularioId },
          indiceFila,
          beneficiario: conFicha.beneficiarioId
            ? { id: conFicha.beneficiarioId }
            : IsNull(),
        },
      });
      if (existente) {
        return this.actualizar(
          existente.id,
          { respuestas: dto.respuestas },
          usuarioActual,
        );
      }
    }

    const ahora = new Date();

    const envioGuardado = await this.dataSource.transaction(async (manager) => {
      const envio = manager.create(EnvioFormulario, {
        enviadoEn: ahora,
        sincronizadoEn: ahora,
        esOffline: false,
        indiceFila,
        datosRaw: {
          respuestas: dto.respuestas,
          usuarioId: usuarioActual.id,
          autocompletado: conFicha.registro,
        },
        jornada: dto.jornadaId ? { id: dto.jornadaId } : null,
        beneficiario: conFicha.beneficiarioId
          ? { id: conFicha.beneficiarioId }
          : null,
        usuario: { id: usuarioActual.id },
        plantillaFormulario: { id: dto.plantillaFormularioId },
      });

      const guardado = await manager.save(EnvioFormulario, envio);

      for (const entrada of conFicha.respuestas) {
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
      await this.guardarUbicacionDeJornada(
        dto.jornadaId,
        plantilla.campos ?? [],
        conFicha.respuestas,
      );
      await this.colaEnviosService.encolarProcesarEnvio({
        envioId: envioGuardado.id,
        jornadaId: dto.jornadaId,
      });

      const jornada = await this.jornadaRepository.findOne({
        where: { id: dto.jornadaId },
        relations: { proyecto: true },
      });

      if (jornada?.proyecto?.id) {
        await this.cronologiaService.registrar({
          actorId: usuarioActual.id,
          proyectoId: jornada.proyecto.id,
          accion: 'FORMULARIO_ENVIADO',
          entidadTipo: 'envio_formulario',
          entidadId: envioGuardado.id,
          contextoTitulo: { nombrePlantilla: plantilla.nombre },
          detalle: detalleConOrigen('api', {
            jornadaId: dto.jornadaId,
            plantillaId: plantilla.id,
          }),
        });
      }
    }

    const envioCompleto = await this.envioRepository.findOne({
      where: { id: envioGuardado.id },
      relations: {
        jornada: true,
        usuario: true,
        plantillaFormulario: true,
        beneficiario: true,
      },
    });

    return aRespuestaEnvio(envioCompleto!);
  }

  async listarPorJornada(
    jornadaId: string,
  ): Promise<RespuestaEnvioFormularioDto[]> {
    await this.jornadasService.obtenerUna(jornadaId);

    const envios = await this.envioRepository.find({
      where: { jornada: { id: jornadaId } },
      relations: {
        jornada: true,
        usuario: true,
        plantillaFormulario: true,
        beneficiario: true,
      },
      order: { indiceFila: 'ASC', enviadoEn: 'DESC' },
    });

    return envios.map((e) => aRespuestaEnvio(e));
  }

  async eliminar(envioId: string): Promise<void> {
    const envio = await this.envioRepository.findOne({
      where: { id: envioId },
    });
    if (!envio) {
      throw new NotFoundException(`Envío ${envioId} no encontrado`);
    }
    await this.respuestaRepository.delete({ envioFormulario: { id: envioId } });
    await this.envioRepository.delete(envioId);
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
      tipoCampo: r.campoFormulario?.tipoCampo,
      valorTexto: r.valorTexto,
      valorNumero: r.valorNumero != null ? Number(r.valorNumero) : undefined,
      valorFecha: r.valorFecha
        ? this.formatearFechaParaCliente(r.valorFecha)
        : undefined,
      valorBooleano: r.valorBooleano,
      valorJson: r.valorJson ?? undefined,
      urlArchivo: r.urlArchivo,
    }));

    return aRespuestaDetalle(detalle);
  }

  async obtenerEnvioPrevio(
    plantillaFormularioId: string,
    usuario: Usuario,
    jornadaId?: string,
    beneficiarioId?: string,
  ): Promise<RespuestaEnvioPrevioDto> {
    const plantilla = await this.plantillaRepository.findOne({
      where: { id: plantillaFormularioId },
    });

    if (!plantilla) {
      throw new NotFoundException(
        `Plantilla ${plantillaFormularioId} no encontrada`,
      );
    }

    if (jornadaId) {
      await this.jornadasService.assertAccesoJornada(jornadaId, usuario);
    }

    const qb = this.envioRepository
      .createQueryBuilder('envio')
      .leftJoinAndSelect('envio.jornada', 'jornada')
      .leftJoinAndSelect('envio.usuario', 'usuario')
      .leftJoinAndSelect('envio.plantillaFormulario', 'plantillaFormulario')
      .leftJoinAndSelect('envio.beneficiario', 'beneficiario')
      .where('envio.plantilla_formulario_id = :plantillaId', {
        plantillaId: plantillaFormularioId,
      });

    if (jornadaId) {
      qb.andWhere('envio.jornada_id = :jornadaId', { jornadaId });
      if (beneficiarioId) {
        qb.andWhere('envio.beneficiario_id = :beneficiarioId', {
          beneficiarioId,
        });
      }
    } else {
      qb.andWhere('envio.jornada_id IS NULL').andWhere(
        'envio.usuario_id = :usuarioId',
        { usuarioId: usuario.id },
      );
    }

    const envio = await qb.orderBy('envio.enviado_en', 'DESC').getOne();

    if (!envio) {
      return aRespuestaEnvioPrevio(null, []);
    }

    const respuestas = await this.obtenerRespuestas(envio.id);
    return aRespuestaEnvioPrevio(aRespuestaEnvio(envio), respuestas);
  }

  async actualizar(
    envioId: string,
    dto: ActualizarEnvioFormularioDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaEnvioFormularioDto> {
    const envio = await this.envioRepository.findOne({
      where: { id: envioId },
      relations: {
        plantillaFormulario: { campos: true },
        jornada: true,
        usuario: true,
        beneficiario: true,
      },
    });

    if (!envio) {
      throw new NotFoundException(`Envío ${envioId} no encontrado`);
    }

    if (envio.jornada?.id) {
      await this.asegurarJornadaEditableParaCaptura(envio.jornada.id);
    }

    const plantilla = envio.plantillaFormulario;

    if (!plantilla) {
      throw new NotFoundException('Plantilla del envío no encontrada');
    }

    const corregidasPorAdmin = corregidasDe(envio);
    const conFicha = await this.aplicarFicha({
      plantilla,
      jornadaId: envio.jornada?.id,
      beneficiarioId: envio.beneficiario?.id,
      respuestas: dto.respuestas as RespuestaEntrada[],
      corregidasPorAdmin,
    });
    // Lo que corrigió un administrador no lo cambia el técnico al reenviar.
    const respuestasFinales = await this.conservarCorreccionesAdmin(
      envioId,
      conFicha.respuestas,
      corregidasPorAdmin,
    );

    this.validarCamposObligatorios(plantilla.campos ?? [], respuestasFinales);

    const ahora = new Date();

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RespuestaFormulario, {
        envioFormulario: { id: envioId },
      });

      for (const entrada of respuestasFinales) {
        const campo = plantilla.campos?.find(
          (c) => c.clave === entrada.claveCampo,
        );

        if (!campo) {
          continue;
        }

        const respuesta = this.mapearRespuesta(
          manager,
          envioId,
          campo,
          entrada.valor,
        );

        await manager.save(RespuestaFormulario, respuesta);
      }

      await manager.update(EnvioFormulario, envioId, {
        enviadoEn: ahora,
        sincronizadoEn: ahora,
        datosRaw: {
          respuestas: dto.respuestas,
          usuarioId: usuarioActual.id,
          actualizadoPor: usuarioActual.id,
          autocompletado: conFicha.registro,
          corregidasPorAdmin,
        },
      });
    });

    if (envio.jornada?.id) {
      await this.guardarUbicacionDeJornada(
        envio.jornada.id,
        plantilla.campos ?? [],
        respuestasFinales,
      );
      await this.colaEnviosService.encolarProcesarEnvio({
        envioId,
        jornadaId: envio.jornada.id,
      });
    }

    const actualizado = await this.envioRepository.findOne({
      where: { id: envioId },
      relations: {
        jornada: true,
        usuario: true,
        plantillaFormulario: true,
        beneficiario: true,
      },
    });

    return aRespuestaEnvio(actualizado!);
  }

  /**
   * Corrección de un administrador: puede cambiar cualquier respuesta, incluidas
   * las autocompletadas y las de jornadas en revisión o completadas. Cada cambio
   * queda en la auditoría y esas preguntas ya no se recalculan desde la ficha.
   */
  async corregir(
    envioId: string,
    dto: CorregirEnvioFormularioDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaEnvioFormularioDto> {
    const envio = await this.envioRepository.findOne({
      where: { id: envioId },
      relations: {
        plantillaFormulario: { campos: true },
        jornada: { proyecto: true },
        beneficiario: true,
      },
    });
    if (!envio) {
      throw new NotFoundException(`Envío ${envioId} no encontrado`);
    }
    const plantilla = envio.plantillaFormulario;
    const campos = plantilla?.campos ?? [];
    const motivo = dto.motivo.trim();

    const anteriores = new Map(
      (await this.respuestaRepository.find({
        where: { envioFormulario: { id: envioId } },
      })).map((r) => [r.claveCampo, valorComparable(r)]),
    );

    const cambiadas: Array<{ clave: string; antes: unknown; despues: unknown }> = [];
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RespuestaFormulario, {
        envioFormulario: { id: envioId },
      });
      for (const entrada of dto.respuestas) {
        const campo = campos.find((c) => c.clave === entrada.claveCampo);
        if (!campo) continue;
        const respuesta = this.mapearRespuesta(manager, envioId, campo, entrada.valor);
        await manager.save(RespuestaFormulario, respuesta);
        const despues = valorComparable(respuesta);
        if (JSON.stringify(anteriores.get(campo.clave) ?? null) !== JSON.stringify(despues)) {
          cambiadas.push({
            clave: campo.clave,
            antes: anteriores.get(campo.clave) ?? null,
            despues,
          });
        }
      }
      for (const [clave, antes] of anteriores) {
        if (dto.respuestas.some((r) => r.claveCampo === clave)) continue;
        cambiadas.push({ clave, antes, despues: null });
      }

      const corregidas = [
        ...new Set([...corregidasDe(envio), ...cambiadas.map((c) => c.clave)]),
      ];
      await manager.update(EnvioFormulario, envioId, {
        datosRaw: {
          ...(envio.datosRaw ?? {}),
          corregidasPorAdmin: corregidas,
          ultimaCorreccion: {
            usuarioId: usuarioActual.id,
            en: new Date().toISOString(),
            motivo,
          },
        },
      });
    });

    const proyectoId = envio.jornada?.proyecto?.id;
    if (proyectoId) {
      for (const cambio of cambiadas) {
        await this.auditoriaService.registrar({
          entityType: 'envio_formulario',
          entityId: envioId,
          field: cambio.clave,
          previousValue: cambio.antes,
          newValue: cambio.despues,
          reason: motivo,
          action: AccionAuditoria.UPDATE,
          user: usuarioActual,
          projectId: proyectoId,
          jornadaId: envio.jornada?.id ?? null,
        });
      }
    }

    const actualizado = await this.envioRepository.findOne({
      where: { id: envioId },
      relations: {
        jornada: true,
        usuario: true,
        plantillaFormulario: true,
        beneficiario: true,
      },
    });
    return aRespuestaEnvio(actualizado!);
  }

  /** Para las claves corregidas por un administrador, deja el valor que él guardó. */
  private async conservarCorreccionesAdmin(
    envioId: string,
    respuestas: RespuestaEntrada[],
    corregidas: string[],
  ): Promise<RespuestaEntrada[]> {
    if (!corregidas.length) return respuestas;
    const guardadas = await this.obtenerRespuestas(envioId);
    const porClave = new Map(guardadas.map((r) => [r.claveCampo, r]));
    const resultado = respuestas.filter((r) => !corregidas.includes(r.claveCampo));
    for (const clave of corregidas) {
      const guardada = porClave.get(clave);
      if (!guardada) continue;
      const valor =
        guardada.valorJson ??
        guardada.valorFecha ??
        guardada.valorNumero ??
        guardada.valorBooleano ??
        guardada.urlArchivo ??
        guardada.valorTexto;
      if (valor !== undefined && valor !== null) {
        resultado.push({ claveCampo: clave, valor });
      }
    }
    return resultado;
  }

  private async asegurarJornadaEditableParaCaptura(
    jornadaId: string,
  ): Promise<void> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId },
    });
    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }
    if (!estadoEditable(jornada.estadoFuncional)) {
      throw new BadRequestException(
        `La jornada está en ${jornada.estadoFuncional} y no admite cambios en formularios. Espera la revisión o una solicitud de corrección.`,
      );
    }
  }

  private formatearFechaParaCliente(valor: Date): string {
    const y = valor.getUTCFullYear();
    const m = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const d = String(valor.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parsearFechaCampo(valor: unknown, etiquetaCampo?: string): Date {
    const etiqueta = etiquetaCampo ? ` "${etiquetaCampo}"` : '';

    if (valor == null || valor === '') {
      throw new BadRequestException(
        `La fecha del campo${etiqueta} es obligatoria o llegó vacía`,
      );
    }

    // Solo aceptamos YYYY-MM-DD (lo que envía <input type="date">).
    const texto =
      typeof valor === 'string'
        ? valor.trim().slice(0, 10)
        : String(valor).trim().slice(0, 10);

    const coincide = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!coincide) {
      throw new BadRequestException(
        `La fecha del campo${etiqueta} no es válida (se espera AAAA-MM-DD). Recibido: ${JSON.stringify(valor)}`,
      );
    }

    const anio = Number(coincide[1]);
    const mes = Number(coincide[2]);
    const dia = Number(coincide[3]);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));

    if (
      Number.isNaN(fecha.getTime()) ||
      fecha.getUTCFullYear() !== anio ||
      fecha.getUTCMonth() !== mes - 1 ||
      fecha.getUTCDate() !== dia
    ) {
      throw new BadRequestException(
        `La fecha del campo${etiqueta} no es una fecha de calendario válida`,
      );
    }

    return fecha;
  }

  private normalizarValorTabla(valor: unknown): {
    filas: Record<string, unknown>[];
  } {
    if (valor == null || typeof valor !== 'object') {
      throw new BadRequestException(
        'El valor de un campo TABLA debe ser un objeto { filas: [...] }',
      );
    }

    const bruto = valor as { filas?: unknown };
    if (!Array.isArray(bruto.filas)) {
      throw new BadRequestException(
        'El valor de un campo TABLA debe incluir filas como arreglo',
      );
    }

    const filas: Record<string, unknown>[] = [];
    for (const fila of bruto.filas) {
      if (fila == null || typeof fila !== 'object' || Array.isArray(fila)) {
        throw new BadRequestException(
          'Cada fila de un campo TABLA debe ser un objeto',
        );
      }
      filas.push(fila as Record<string, unknown>);
    }

    return { filas };
  }

  private parsearBooleano(valor: unknown): boolean {
    if (valor === true || valor === 1) return true;
    if (valor === false || valor === 0) return false;
    if (typeof valor === 'string') {
      const texto = valor.trim().toLowerCase();
      if (
        texto === 'si' ||
        texto === 'sí' ||
        texto === 'true' ||
        texto === '1'
      ) {
        return true;
      }
      if (texto === 'no' || texto === 'false' || texto === '0') {
        return false;
      }
    }
    return Boolean(valor);
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

      if (campo.tipoCampo === TipoCampo.TABLA) {
        if (valor === undefined || valor === null) {
          throw new BadRequestException(
            `El campo obligatorio "${campo.etiqueta}" (${campo.clave}) no fue completado`,
          );
        }
        const tabla = this.normalizarValorTabla(valor);
        if (tabla.filas.length === 0) {
          throw new BadRequestException(
            `El campo obligatorio "${campo.etiqueta}" (${campo.clave}) requiere al menos una fila`,
          );
        }
        continue;
      }

      if (valor === undefined || valor === null || valor === '') {
        throw new BadRequestException(
          `El campo obligatorio "${campo.etiqueta}" (${campo.clave}) no fue completado`,
        );
      }
    }
  }

  /** Copia el GPS del formulario a la jornada: es el punto real del momento de captura. */
  private async guardarUbicacionDeJornada(
    jornadaId: string,
    campos: CampoFormulario[],
    respuestas: RespuestaEntrada[],
  ): Promise<void> {
    const ubicacion = this.extraerUbicacionGps(campos, respuestas);
    if (!ubicacion) return;
    await this.jornadaRepository.update(jornadaId, {
      latitud: ubicacion.latitud,
      longitud: ubicacion.longitud,
    });
  }

  private extraerUbicacionGps(
    campos: CampoFormulario[],
    respuestas: RespuestaEntrada[],
  ): { latitud: number; longitud: number } | null {
    const mapa = new Map(respuestas.map((r) => [r.claveCampo, r.valor]));
    const ordenados = [...campos].sort((a, b) => a.orden - b.orden);
    for (const campo of ordenados) {
      if (campo.tipoCampo !== TipoCampo.GPS) continue;
      const valor = mapa.get(campo.clave);
      if (!valor || typeof valor !== 'object' || Array.isArray(valor)) continue;
      const punto = valor as { latitud?: unknown; longitud?: unknown };
      if (
        typeof punto.latitud !== 'number' ||
        typeof punto.longitud !== 'number' ||
        !Number.isFinite(punto.latitud) ||
        !Number.isFinite(punto.longitud)
      ) {
        continue;
      }
      return { latitud: punto.latitud, longitud: punto.longitud };
    }
    return null;
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
          valorFecha: this.parsearFechaCampo(valor, campo.etiqueta),
        });
      case TipoCampo.SI_NO:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorBooleano: this.parsearBooleano(valor),
        });
      case TipoCampo.TABLA:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorJson:
            valor == null ? { filas: [] } : this.normalizarValorTabla(valor),
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
