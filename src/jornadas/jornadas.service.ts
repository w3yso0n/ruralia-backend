import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Actividad } from '../actividades/entities/actividad.entity';
import { Meta } from '../actividades/entities/meta.entity';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import {
  CronologiaService,
  detalleConOrigen,
} from '../cronologia/cronologia.service';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { TipoEvidencia } from '../evidencias/enums/tipo-evidencia.enum';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { CampoFormulario } from '../formularios/entities/campo-formulario.entity';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { TipoPlantilla } from '../formularios/enums/tipo-plantilla.enum';
import { TipoCampo } from '../formularios/enums/tipo-campo.enum';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { EstadoProyecto } from '../proyectos/enums/estado-proyecto.enum';
import {
  usuarioEsCoordinacion,
  usuarioTieneAccesoTotal,
} from '../usuarios/utils/permisos-usuario';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActividadJornadaDto,
  ActualizarJornadaDto,
  AgregarBeneficiariosDto,
  AgregarMiembroEquipoDto,
  CambiarEstadoJornadaDto,
  CrearJornadaDto,
} from './dto/jornada.dto';
import {
  ActualizarAsistenteJornadaDto,
  CrearAsistenteJornadaDto,
  GuardarAsistenciaJornadaDto,
  RespuestaAsistenteJornadaDto,
} from './dto/asistencia-jornada.dto';
import { FiltrosJornadaDto } from './dto/filtros-jornada.dto';
import {
  ResumenJornadaDto,
  RespuestaJornadaDto,
  RespuestaPaginadaJornadasDto,
} from './dto/respuesta-jornada.dto';
import { JornadaActividad } from './entities/jornada-actividad.entity';
import { JornadaAsistente } from './entities/jornada-asistente.entity';
import { Jornada } from './entities/jornada.entity';
import { EstadoEjecucionJornada } from './enums/estado-ejecucion-jornada.enum';
import { EstadoJornada } from './enums/estado-jornada.enum';
import { TipoJornada } from './enums/tipo-jornada.enum';
import {
  aResumenJornada,
  aRespuestaJornada,
  aRespuestaPaginadaJornadas,
} from './utils/serializar-jornada';
import { sumarEjecutadoPorMeta } from './utils/calcular-ejecutado-meta';
import { generarPdfAsistenciaJornada } from './utils/generar-pdf-asistencia';

const TRANSICIONES_VALIDAS: Partial<
  Record<EstadoJornada, EstadoJornada[]>
> = {
  [EstadoJornada.PLANIFICADA]: [EstadoJornada.EN_PROGRESO, EstadoJornada.CANCELADA],
  [EstadoJornada.EN_PROGRESO]: [EstadoJornada.COMPLETADA, EstadoJornada.CANCELADA],
};

@Injectable()
export class JornadasService {
  constructor(
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(JornadaActividad)
    private readonly jornadaActividadRepository: Repository<JornadaActividad>,
    @InjectRepository(JornadaAsistente)
    private readonly asistenteRepository: Repository<JornadaAsistente>,
    @InjectRepository(Meta)
    private readonly metaRepository: Repository<Meta>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(Actividad)
    private readonly actividadRepository: Repository<Actividad>,
    @InjectRepository(Subactividad)
    private readonly subactividadRepository: Repository<Subactividad>,
    @InjectRepository(Beneficiario)
    private readonly beneficiarioRepository: Repository<Beneficiario>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
    @InjectRepository(PlantillaFormulario)
    private readonly plantillaRepository: Repository<PlantillaFormulario>,
    @InjectRepository(RespuestaFormulario)
    private readonly respuestaRepository: Repository<RespuestaFormulario>,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
    private readonly cronologiaService: CronologiaService,
  ) {}

  async crear(
    dto: CrearJornadaDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaJornadaDto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: dto.proyectoId },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${dto.proyectoId} no encontrado`);
    }

    if (proyecto.estado !== EstadoProyecto.ACTIVO) {
      throw new BadRequestException(
        'Solo se pueden crear jornadas en proyectos ACTIVOS',
      );
    }

    if (!dto.metaId && (!dto.actividades || dto.actividades.length === 0)) {
      throw new BadRequestException(
        'Debe seleccionar una meta del plan para vincular formularios en campo',
      );
    }

    const tecnicoId = dto.tecnicoResponsableId ?? usuarioActual.id;
    const tecnico = await this.usuarioRepository.findOne({
      where: { id: tecnicoId },
    });
    if (!tecnico) {
      throw new NotFoundException(`Usuario técnico ${tecnicoId} no encontrado`);
    }

    if (dto.metaId) {
      const meta = await this.metaRepository.findOne({
        where: { id: dto.metaId },
        relations: {
          proceso: { subactividad: { actividad: { proyecto: true } } },
        },
      });

      if (!meta) {
        throw new NotFoundException(`Meta ${dto.metaId} no encontrada`);
      }

      if (meta.proceso.subactividad.actividad.proyecto.id !== dto.proyectoId) {
        throw new BadRequestException(
          'La meta no pertenece al proyecto indicado',
        );
      }
    }

    const lineas =
      dto.actividades && dto.actividades.length > 0
        ? await this.validarActividadesJornada(dto.proyectoId, dto.actividades)
        : [];

    const jornada = this.jornadaRepository.create({
      fecha: new Date(dto.fecha),
      nombre: dto.nombre?.trim() ? dto.nombre.trim() : null,
      observaciones: dto.observaciones,
      latitud: dto.latitud,
      longitud: dto.longitud,
      tipo: dto.tipo ?? TipoJornada.INDIVIDUAL,
      proyecto: { id: dto.proyectoId },
      meta: dto.metaId ? ({ id: dto.metaId } as Meta) : null,
      vereda: { id: dto.veredaId },
      tecnicoResponsable: { id: tecnicoId },
      tecnicoResponsableNombre: tecnico.nombreCompleto,
      equipo: [{ id: tecnicoId }],
      jornadaActividades: lineas,
    });

    const guardada = await this.jornadaRepository.save(jornada);
    const respuesta = await this.obtenerUna(guardada.id);

    await this.cronologiaService.registrar({
      actorId: tecnicoId,
      proyectoId: dto.proyectoId,
      accion: 'JORNADA_CREADA',
      entidadTipo: 'jornada',
      entidadId: guardada.id,
      contextoTitulo: {
        nombreJornadaFecha: this.formatoFechaTitulo(dto.fecha),
      },
      detalle: detalleConOrigen('api'),
    });

    return respuesta;
  }

  async listar(
    filtros: FiltrosJornadaDto,
  ): Promise<RespuestaPaginadaJornadasDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 10;
    const skip = (pagina - 1) * limite;

    const query = this.jornadaRepository
      .createQueryBuilder('jornada')
      .leftJoinAndSelect('jornada.proyecto', 'proyecto')
      .leftJoinAndSelect('jornada.vereda', 'vereda')
      .leftJoinAndSelect('jornada.meta', 'meta')
      .leftJoinAndSelect('meta.proceso', 'proceso')
      .leftJoinAndSelect('proceso.subactividad', 'subactividad')
      .leftJoinAndSelect('subactividad.actividad', 'actividad')
      .leftJoinAndSelect('jornada.jornadaActividades', 'ja')
      .leftJoinAndSelect('ja.actividad', 'actividadJa')
      .leftJoinAndSelect('ja.subactividad', 'subactividadJa')
      .leftJoinAndSelect('jornada.tecnicoResponsable', 'tecnico')
      .orderBy('jornada.fecha', 'DESC')
      .addOrderBy('ja.orden', 'ASC');

    if (filtros.proyectoId) {
      query.andWhere('jornada.proyecto_id = :proyectoId', {
        proyectoId: filtros.proyectoId,
      });
    }

    if (filtros.actividadId) {
      query.andWhere(
        'EXISTS (SELECT 1 FROM jornada_actividades jax WHERE jax.jornada_id = jornada.id AND jax.actividad_id = :actividadId)',
        { actividadId: filtros.actividadId },
      );
    }

    if (filtros.estado) {
      query.andWhere('jornada.estado = :estado', { estado: filtros.estado });
    }

    if (filtros.fechaDesde) {
      query.andWhere('jornada.fecha >= :fechaDesde', {
        fechaDesde: filtros.fechaDesde,
      });
    }

    if (filtros.fechaHasta) {
      query.andWhere('jornada.fecha <= :fechaHasta', {
        fechaHasta: filtros.fechaHasta,
      });
    }

    if (filtros.usuarioId) {
      query.andWhere(
        '(jornada.tecnico_responsable_id = :usuarioId OR EXISTS (SELECT 1 FROM jornada_equipo je WHERE je.jornada_id = jornada.id AND je.usuario_id = :usuarioId))',
        { usuarioId: filtros.usuarioId },
      );
    }

    const [jornadas, total] = await query.skip(skip).take(limite).getManyAndCount();
    const datos = jornadas.map((j) => aRespuestaJornada(j));
    return aRespuestaPaginadaJornadas(datos, total, pagina, limite);
  }

  async listarAsignadasAUsuario(
    usuario: Usuario,
    filtros?: { estado?: EstadoJornada; proyectoId?: string; pagina?: number; limite?: number },
  ): Promise<RespuestaPaginadaJornadasDto> {
    const pagina = filtros?.pagina ?? 1;
    const limite = filtros?.limite ?? 50;
    const skip = (pagina - 1) * limite;

    const query = this.jornadaRepository
      .createQueryBuilder('jornada')
      .leftJoinAndSelect('jornada.proyecto', 'proyecto')
      .leftJoinAndSelect('jornada.vereda', 'vereda')
      .leftJoinAndSelect('jornada.meta', 'meta')
      .leftJoinAndSelect('meta.proceso', 'proceso')
      .leftJoinAndSelect('proceso.subactividad', 'subactividad')
      .leftJoinAndSelect('subactividad.actividad', 'actividad')
      .where(
        '(jornada.tecnico_responsable_id = :usuarioId OR EXISTS (SELECT 1 FROM jornada_equipo je WHERE je.jornada_id = jornada.id AND je.usuario_id = :usuarioId))',
        { usuarioId: usuario.id },
      )
      .andWhere('jornada.estado != :cancelada', { cancelada: EstadoJornada.CANCELADA })
      .orderBy('jornada.fecha', 'ASC');

    if (filtros?.estado) {
      query.andWhere('jornada.estado = :estado', { estado: filtros.estado });
    }

    if (filtros?.proyectoId) {
      query.andWhere('jornada.proyecto_id = :proyectoId', { proyectoId: filtros.proyectoId });
    }

    const [jornadas, total] = await query.skip(skip).take(limite).getManyAndCount();
    const datos = jornadas.map((j) => aRespuestaJornada(j));
    return aRespuestaPaginadaJornadas(datos, total, pagina, limite);
  }

  async obtenerUna(id: string): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id },
      relations: {
        proyecto: true,
        meta: {
          proceso: { subactividad: { actividad: true } },
        },
        jornadaActividades: { actividad: true, subactividad: true },
        vereda: true,
        tecnicoResponsable: true,
        beneficiarios: true,
        equipo: true,
        asistentes: true,
      },
      order: {
        jornadaActividades: { orden: 'ASC' },
        asistentes: { orden: 'ASC' },
      },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    const envios = await this.envioRepository.find({
      where: { jornada: { id } },
      relations: { plantillaFormulario: true },
    });

    const evidencias = await this.evidenciaRepository.find({
      where: { jornada: { id } },
    });

    let metaEjecutadoTotal: number | undefined;
    if (jornada.meta?.id) {
      metaEjecutadoTotal = await sumarEjecutadoPorMeta(
        this.jornadaRepository,
        jornada.meta.id,
      );
    }

    return aRespuestaJornada(jornada, {
      enviosFormulario: envios,
      evidencias,
      metaEjecutadoTotal,
    });
  }

  async actualizar(
    id: string,
    dto: ActualizarJornadaDto,
  ): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id },
      relations: { proyecto: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    if (dto.fecha !== undefined) jornada.fecha = new Date(dto.fecha);
    if (dto.nombre !== undefined) {
      jornada.nombre = dto.nombre.trim() ? dto.nombre.trim() : null;
    }
    if (dto.observaciones !== undefined) jornada.observaciones = dto.observaciones;
    if (dto.latitud !== undefined) jornada.latitud = dto.latitud;
    if (dto.longitud !== undefined) jornada.longitud = dto.longitud;
    if (dto.cantidadEjecutada !== undefined) {
      jornada.cantidadEjecutada = dto.cantidadEjecutada;
    }
    if (dto.tipo !== undefined) {
      jornada.tipo = dto.tipo;
    }
    if (dto.veredaId !== undefined) {
      jornada.vereda = { id: dto.veredaId } as Jornada['vereda'];
    }

    if (dto.metaId !== undefined) {
      const meta = await this.metaRepository.findOne({
        where: { id: dto.metaId },
        relations: {
          proceso: { subactividad: { actividad: { proyecto: true } } },
        },
      });

      if (!meta) {
        throw new NotFoundException(`Meta ${dto.metaId} no encontrada`);
      }

      if (meta.proceso.subactividad.actividad.proyecto.id !== jornada.proyecto.id) {
        throw new BadRequestException(
          'La meta no pertenece al proyecto de la jornada',
        );
      }

      jornada.meta = { id: dto.metaId } as Meta;
    }

    if (dto.actividades !== undefined) {
      await this.jornadaActividadRepository.delete({ jornada: { id } });
      const lineas = await this.validarActividadesJornada(
        jornada.proyecto.id,
        dto.actividades,
      );
      jornada.jornadaActividades = lineas.map((linea) =>
        this.jornadaActividadRepository.create({ ...linea, jornada: { id } }),
      );
    }

    await this.jornadaRepository.save(jornada);
    return this.obtenerUna(id);
  }

  async cancelar(
    id: string,
    usuarioActual: Usuario,
  ): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id },
      relations: { proyecto: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    if (jornada.estado === EstadoJornada.CANCELADA) {
      return this.obtenerUna(id);
    }

    jornada.estado = EstadoJornada.CANCELADA;
    await this.jornadaRepository.save(jornada);

    const fechaStr =
      jornada.fecha instanceof Date
        ? jornada.fecha.toISOString().slice(0, 10)
        : String(jornada.fecha).slice(0, 10);

    await this.cronologiaService.registrar({
      actorId: usuarioActual.id,
      proyectoId: jornada.proyecto.id,
      accion: 'JORNADA_CANCELADA',
      entidadTipo: 'jornada',
      entidadId: id,
      contextoTitulo: {
        nombreJornadaFecha: this.formatoFechaTitulo(fechaStr),
      },
      detalle: detalleConOrigen('api'),
    });

    return this.obtenerUna(id);
  }

  async eliminar(id: string): Promise<void> {
    const jornada = await this.jornadaRepository.findOne({ where: { id } });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    const [envios, evidencias] = await Promise.all([
      this.envioRepository.count({ where: { jornada: { id } } }),
      this.evidenciaRepository.count({ where: { jornada: { id } } }),
    ]);

    if (envios > 0 || evidencias > 0) {
      throw new BadRequestException(
        'No se puede eliminar una jornada con formularios enviados o evidencias registradas',
      );
    }

    await this.jornadaActividadRepository.delete({ jornada: { id } });
    await this.jornadaRepository.remove(jornada);
  }

  async cambiarEstado(
    id: string,
    dto: CambiarEstadoJornadaDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id },
      relations: { equipo: true, tecnicoResponsable: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    this.verificarPermisoEstado(jornada, usuarioActual);

    const transiciones = TRANSICIONES_VALIDAS[jornada.estado] ?? [];

    if (!transiciones.includes(dto.estado)) {
      throw new BadRequestException(
        `No se puede cambiar de ${jornada.estado} a ${dto.estado}`,
      );
    }

    const estadoAnterior = jornada.estado;
    jornada.estado = dto.estado;
    await this.jornadaRepository.save(jornada);

    const jornadaConProyecto = await this.jornadaRepository.findOne({
      where: { id },
      relations: { proyecto: true },
    });

    if (jornadaConProyecto?.proyecto?.id) {
      const accion =
        dto.estado === EstadoJornada.CANCELADA
          ? 'JORNADA_CANCELADA'
          : 'JORNADA_ESTADO_CAMBIADO';

      const fechaStr =
        jornadaConProyecto.fecha instanceof Date
          ? jornadaConProyecto.fecha.toISOString().slice(0, 10)
          : String(jornadaConProyecto.fecha).slice(0, 10);

      await this.cronologiaService.registrar({
        actorId: usuarioActual.id,
        proyectoId: jornadaConProyecto.proyecto.id,
        accion,
        entidadTipo: 'jornada',
        entidadId: id,
        contextoTitulo: {
          estadoAnterior,
          estadoNuevo: dto.estado,
          nombreJornadaFecha: this.formatoFechaTitulo(fechaStr),
        },
        detalle: detalleConOrigen('api', {
          estadoAnterior,
          estadoNuevo: dto.estado,
        }),
      });
    }

    return this.obtenerUna(id);
  }

  async agregarBeneficiarios(
    jornadaId: string,
    dto: AgregarBeneficiariosDto,
  ): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId },
      relations: { beneficiarios: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }

    const beneficiarios = await this.beneficiarioRepository.findBy({
      id: In(dto.beneficiarioIds),
    });

    if (beneficiarios.length !== dto.beneficiarioIds.length) {
      throw new NotFoundException('Uno o más beneficiarios no existen');
    }

    const existentes = new Set(jornada.beneficiarios?.map((b) => b.id) ?? []);
    const nuevos = beneficiarios.filter((b) => !existentes.has(b.id));
    jornada.beneficiarios = [...(jornada.beneficiarios ?? []), ...nuevos];

    await this.jornadaRepository.save(jornada);
    return this.obtenerUna(jornadaId);
  }

  async agregarMiembroEquipo(
    jornadaId: string,
    dto: AgregarMiembroEquipoDto,
  ): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId },
      relations: { equipo: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }

    const usuario = await this.usuarioRepository.findOne({
      where: { id: dto.usuarioId },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);
    }

    const yaEnEquipo = jornada.equipo?.some((u) => u.id === dto.usuarioId);

    if (!yaEnEquipo) {
      jornada.equipo = [...(jornada.equipo ?? []), usuario];
      await this.jornadaRepository.save(jornada);
    }

    return this.obtenerUna(jornadaId);
  }

  async obtenerResumen(jornadaId: string): Promise<ResumenJornadaDto> {
    await this.buscarJornada(jornadaId);

    const conteoFormularios = await this.envioRepository.countBy({
      jornada: { id: jornadaId },
    });

    const conteoEvidencias = await this.evidenciaRepository.countBy({
      jornada: { id: jornadaId },
    });

    const conteoFirmas = await this.evidenciaRepository.countBy({
      jornada: { id: jornadaId },
      tipo: TipoEvidencia.FIRMA,
    });

    const resultado = await this.jornadaRepository
      .createQueryBuilder('jornada')
      .innerJoin('jornada.beneficiarios', 'beneficiario')
      .where('jornada.id = :jornadaId', { jornadaId })
      .select('COUNT(DISTINCT beneficiario.id)', 'conteo')
      .getRawOne<{ conteo: string }>();

    return aResumenJornada({
      conteoFormularios,
      conteoEvidencias,
      conteoFirmas,
      beneficiariosAtendidos: Number(resultado?.conteo ?? 0),
    });
  }

  async listarAsistencia(
    jornadaId: string,
  ): Promise<RespuestaAsistenteJornadaDto[]> {
    await this.asegurarJornadaGrupal(jornadaId);
    const asistentes = await this.asistenteRepository.find({
      where: { jornada: { id: jornadaId } },
      order: { orden: 'ASC' },
    });
    return asistentes.map((a) => this.mapearAsistente(a));
  }

  async guardarAsistencia(
    jornadaId: string,
    dto: GuardarAsistenciaJornadaDto,
  ): Promise<RespuestaAsistenteJornadaDto[]> {
    await this.asegurarJornadaGrupal(jornadaId);

    for (const item of dto.asistentes) {
      this.validarFirmaDataUrl(item.firmaDataUrl);
    }

    await this.asistenteRepository.delete({ jornada: { id: jornadaId } });

    const creados = dto.asistentes.map((item, index) =>
      this.asistenteRepository.create({
        jornada: { id: jornadaId } as Jornada,
        nombreCompleto: item.nombreCompleto.trim(),
        documento: item.documento?.trim() || null,
        firmaDataUrl: item.firmaDataUrl?.trim() || null,
        firmadoEn: item.firmaDataUrl?.trim() ? new Date() : null,
        orden: index,
      }),
    );

    const guardados = await this.asistenteRepository.save(creados);
    return guardados
      .sort((a, b) => a.orden - b.orden)
      .map((a) => this.mapearAsistente(a));
  }

  async agregarAsistente(
    jornadaId: string,
    dto: CrearAsistenteJornadaDto,
  ): Promise<RespuestaAsistenteJornadaDto> {
    await this.asegurarJornadaGrupal(jornadaId);

    const ultimo = await this.asistenteRepository.findOne({
      where: { jornada: { id: jornadaId } },
      order: { orden: 'DESC' },
    });

    const asistente = await this.asistenteRepository.save(
      this.asistenteRepository.create({
        jornada: { id: jornadaId } as Jornada,
        nombreCompleto: dto.nombreCompleto.trim(),
        documento: dto.documento?.trim() || null,
        firmaDataUrl: null,
        firmadoEn: null,
        orden: (ultimo?.orden ?? -1) + 1,
      }),
    );

    return this.mapearAsistente(asistente);
  }

  async actualizarAsistente(
    jornadaId: string,
    asistenteId: string,
    dto: ActualizarAsistenteJornadaDto,
  ): Promise<RespuestaAsistenteJornadaDto> {
    await this.asegurarJornadaGrupal(jornadaId);
    this.validarFirmaDataUrl(dto.firmaDataUrl);

    const asistente = await this.asistenteRepository.findOne({
      where: { id: asistenteId, jornada: { id: jornadaId } },
    });

    if (!asistente) {
      throw new NotFoundException(
        `Asistente ${asistenteId} no encontrado en la jornada`,
      );
    }

    if (dto.nombreCompleto !== undefined) {
      asistente.nombreCompleto = dto.nombreCompleto.trim();
    }
    if (dto.documento !== undefined) {
      asistente.documento = dto.documento?.trim() || null;
    }
    if (dto.firmaDataUrl !== undefined) {
      const firma = dto.firmaDataUrl?.trim() || null;
      asistente.firmaDataUrl = firma;
      asistente.firmadoEn = firma ? new Date() : null;
    }

    const guardado = await this.asistenteRepository.save(asistente);
    return this.mapearAsistente(guardado);
  }

  async eliminarAsistente(
    jornadaId: string,
    asistenteId: string,
  ): Promise<void> {
    await this.asegurarJornadaGrupal(jornadaId);
    const resultado = await this.asistenteRepository.delete({
      id: asistenteId,
      jornada: { id: jornadaId },
    });
    if (!resultado.affected) {
      throw new NotFoundException(
        `Asistente ${asistenteId} no encontrado en la jornada`,
      );
    }
  }

  async generarPdfAsistencia(jornadaId: string): Promise<Buffer> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId },
      relations: {
        proyecto: true,
        vereda: true,
        meta: { proceso: true },
      },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }

    if (jornada.tipo !== TipoJornada.GRUPAL) {
      throw new BadRequestException(
        'Solo las jornadas grupales tienen lista de asistencia en PDF',
      );
    }

    const procesoId = jornada.meta?.proceso?.id;
    if (!procesoId) {
      throw new BadRequestException(
        'La jornada no tiene proceso vinculado para obtener el formulario grupal',
      );
    }

    const plantilla = await this.plantillaRepository.findOne({
      where: {
        procesos: { id: procesoId },
        estaActivo: true,
        tipoPlantilla: TipoPlantilla.GRUPAL,
      },
      relations: { campos: true },
    });

    if (!plantilla) {
      throw new BadRequestException(
        'No hay formulario grupal publicado asignado al proceso',
      );
    }

    const campos = (plantilla.campos ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden);

    const camposTabla = campos.filter((c) => c.tipoCampo === TipoCampo.TABLA);
    const camposCabecera = campos.filter((c) => c.tipoCampo !== TipoCampo.TABLA);

    const envios = await this.envioRepository.find({
      where: {
        jornada: { id: jornadaId },
        plantillaFormulario: { id: plantilla.id },
      },
      order: { indiceFila: 'ASC' },
    });

    const basePdf = {
      proyectoNombre: jornada.proyecto?.nombre ?? 'Proyecto',
      plantillaNombre: plantilla.nombre,
      fecha: jornada.fecha,
      veredaNombre: jornada.vereda?.nombre,
      metaNombre: jornada.meta?.nombre,
      observaciones: jornada.observaciones,
    };

    // Modelo nuevo: cabecera + matrices en un solo envío
    if (camposTabla.length > 0) {
      const envio = envios[0];
      const respuestas = envio
        ? await this.respuestaRepository.find({
            where: { envioFormulario: { id: envio.id } },
          })
        : [];

      const cabecera = camposCabecera.map((campo) => {
        const resp = respuestas.find((r) => r.claveCampo === campo.clave);
        return {
          etiqueta: campo.etiqueta,
          valor: resp ? this.valorRespuestaTexto(resp) : null,
          esFirma: campo.tipoCampo === TipoCampo.FIRMA,
        };
      });

      const tablas = camposTabla.map((campoTabla) => {
        const resp = respuestas.find((r) => r.claveCampo === campoTabla.clave);
        const columnasDef = this.columnasDeTabla(campoTabla);
        const filasBrutas =
          resp?.valorJson && Array.isArray(resp.valorJson.filas)
            ? (resp.valorJson.filas as Record<string, unknown>[])
            : [];

        const filas = filasBrutas.map((fila) => {
          const mapa: Record<string, string | null> = {};
          for (const col of columnasDef) {
            const v = fila[col.clave];
            if (v == null || v === '') {
              mapa[col.clave] = null;
            } else if (typeof v === 'boolean') {
              mapa[col.clave] = v ? 'Sí' : 'No';
            } else {
              mapa[col.clave] = String(v);
            }
          }
          return mapa;
        });

        return {
          titulo: campoTabla.etiqueta,
          columnas: columnasDef.map((c) => ({
            clave: c.clave,
            etiqueta: c.etiqueta,
            esFirma: c.tipoCampo === 'FIRMA',
          })),
          filas,
        };
      });

      return generarPdfAsistenciaJornada({
        ...basePdf,
        cabecera,
        tablas,
      });
    }

    // Legacy: cada envío = una fila; todos los campos son columnas
    const filas: Array<Record<string, string | null>> = [];
    for (const envio of envios) {
      const respuestas = await this.respuestaRepository.find({
        where: { envioFormulario: { id: envio.id } },
        relations: { campoFormulario: true },
      });
      const mapa: Record<string, string | null> = {};
      for (const campo of campos) {
        const resp = respuestas.find((r) => r.claveCampo === campo.clave);
        mapa[campo.clave] = resp ? this.valorRespuestaTexto(resp) : null;
      }
      filas.push(mapa);
    }

    return generarPdfAsistenciaJornada({
      ...basePdf,
      tablas: [
        {
          columnas: campos.map((c) => ({
            clave: c.clave,
            etiqueta: c.etiqueta,
            esFirma: c.tipoCampo === TipoCampo.FIRMA,
          })),
          filas,
        },
      ],
    });
  }

  private columnasDeTabla(campo: CampoFormulario): Array<{
    clave: string;
    etiqueta: string;
    tipoCampo: string;
  }> {
    const opciones = campo.opciones as
      | { columnas?: Array<Record<string, unknown>> }
      | null
      | undefined;
    const columnas = opciones?.columnas;
    if (!Array.isArray(columnas)) return [];

    return columnas
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        clave: String(c.clave ?? ''),
        etiqueta: String(c.etiqueta ?? c.clave ?? ''),
        tipoCampo: String(c.tipoCampo ?? 'TEXTO'),
      }))
      .filter((c) => c.clave);
  }

  private valorRespuestaTexto(resp: RespuestaFormulario): string | null {
    if (resp.urlArchivo != null) return resp.urlArchivo;
    if (resp.valorTexto != null) return resp.valorTexto;
    if (resp.valorNumero != null) return String(resp.valorNumero);
    if (resp.valorFecha != null) return resp.valorFecha.toISOString().slice(0, 10);
    if (resp.valorBooleano != null) return resp.valorBooleano ? 'Sí' : 'No';
    if (resp.valorJson != null) return JSON.stringify(resp.valorJson);
    return null;
  }

  private mapearAsistente(
    asistente: JornadaAsistente,
  ): RespuestaAsistenteJornadaDto {
    return {
      id: asistente.id,
      nombreCompleto: asistente.nombreCompleto,
      documento: asistente.documento,
      firmaDataUrl: asistente.firmaDataUrl,
      firmadoEn: asistente.firmadoEn,
      orden: asistente.orden,
    };
  }

  private async asegurarJornadaGrupal(jornadaId: string): Promise<Jornada> {
    const jornada = await this.buscarJornada(jornadaId);
    if (jornada.tipo !== TipoJornada.GRUPAL) {
      throw new BadRequestException(
        'La lista de asistencia solo aplica a jornadas grupales',
      );
    }
    return jornada;
  }

  private validarFirmaDataUrl(firma?: string | null): void {
    if (firma == null || firma === '') return;
    if (!firma.startsWith('data:image/')) {
      throw new BadRequestException(
        'La firma debe ser una imagen en formato data URL',
      );
    }
    // ~1.5 MB en base64 como techo razonable para firmas
    if (firma.length > 2_000_000) {
      throw new BadRequestException('La firma es demasiado grande');
    }
  }

  private async validarActividadesJornada(
    proyectoId: string,
    actividades: ActividadJornadaDto[],
  ): Promise<Partial<JornadaActividad>[]> {
    const lineas: Partial<JornadaActividad>[] = [];

    for (let i = 0; i < actividades.length; i++) {
      const item = actividades[i];
      const actividad = await this.actividadRepository.findOne({
        where: { id: item.actividadId, proyecto: { id: proyectoId } },
      });

      if (!actividad) {
        throw new BadRequestException(
          `Actividad ${item.actividadId} no pertenece al proyecto`,
        );
      }

      if (item.subactividadId) {
        const sub = await this.subactividadRepository.findOne({
          where: { id: item.subactividadId, actividad: { id: item.actividadId } },
        });

        if (!sub) {
          throw new BadRequestException(
            `Subactividad ${item.subactividadId} no pertenece a la actividad`,
          );
        }
      }

      lineas.push({
        actividad: { id: item.actividadId } as Actividad,
        subactividad: item.subactividadId
          ? ({ id: item.subactividadId } as Subactividad)
          : undefined,
        estadoEjecucion: EstadoEjecucionJornada.PENDIENTE,
        orden: i,
      });
    }

    return lineas;
  }

  private verificarPermisoEstado(
    jornada: Jornada,
    usuarioActual: Usuario,
  ): void {
    if (
      usuarioTieneAccesoTotal(usuarioActual) ||
      usuarioEsCoordinacion(usuarioActual)
    ) {
      return;
    }

    const esCampoAsignado =
      jornada.tecnicoResponsable?.id === usuarioActual.id ||
      jornada.equipo?.some((u) => u.id === usuarioActual.id);

    if (!esCampoAsignado) {
      throw new ForbiddenException(
        'Solo el personal de campo asignado, coordinador o administrador puede cambiar el estado',
      );
    }
  }

  private async buscarJornada(id: string): Promise<Jornada> {
    const jornada = await this.jornadaRepository.findOne({ where: { id } });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    return jornada;
  }

  private formatoFechaTitulo(fechaIso: string): string {
    const [anio, mes, dia] = fechaIso.slice(0, 10).split('-');
    if (!anio || !mes || !dia) return fechaIso;
    return `${dia}/${mes}/${anio}`;
  }
}
