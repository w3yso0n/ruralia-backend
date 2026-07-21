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
import { FiltrosJornadaDto } from './dto/filtros-jornada.dto';
import {
  ResumenJornadaDto,
  RespuestaJornadaDto,
  RespuestaPaginadaJornadasDto,
} from './dto/respuesta-jornada.dto';
import { JornadaActividad } from './entities/jornada-actividad.entity';
import { Jornada } from './entities/jornada.entity';
import { EstadoEjecucionJornada } from './enums/estado-ejecucion-jornada.enum';
import { EstadoJornada } from './enums/estado-jornada.enum';
import {
  aResumenJornada,
  aRespuestaJornada,
  aRespuestaPaginadaJornadas,
} from './utils/serializar-jornada';
import { sumarEjecutadoPorMeta } from './utils/calcular-ejecutado-meta';

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
      observaciones: dto.observaciones,
      latitud: dto.latitud,
      longitud: dto.longitud,
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
      },
      order: { jornadaActividades: { orden: 'ASC' } },
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
    if (dto.observaciones !== undefined) jornada.observaciones = dto.observaciones;
    if (dto.latitud !== undefined) jornada.latitud = dto.latitud;
    if (dto.longitud !== undefined) jornada.longitud = dto.longitud;
    if (dto.cantidadEjecutada !== undefined) {
      jornada.cantidadEjecutada = dto.cantidadEjecutada;
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
