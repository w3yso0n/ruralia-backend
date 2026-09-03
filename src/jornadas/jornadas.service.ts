import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
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
  RespuestaCrearJornadasDto,
  RespuestaHermanoGrupoDto,
  RespuestaJornadaDto,
  RespuestaPaginadaJornadasDto,
} from './dto/respuesta-jornada.dto';
import { JornadaActividad } from './entities/jornada-actividad.entity';
import { JornadaAsistente } from './entities/jornada-asistente.entity';
import { Jornada } from './entities/jornada.entity';
import { EstadoEjecucionJornada } from './enums/estado-ejecucion-jornada.enum';
import { EstadoJornada } from './enums/estado-jornada.enum';
import { TipoJornada } from './enums/tipo-jornada.enum';
import { estadoEditable } from '../common/workflow/maquina-estados';
import {
  aHermanoGrupo,
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
    private readonly dataSource: DataSource,
  ) {}

  async crear(
    dto: CrearJornadaDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaCrearJornadasDto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: dto.proyectoId },
      relations: { personal: true },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${dto.proyectoId} no encontrado`);
    }

    if (proyecto.estado !== EstadoProyecto.ACTIVO) {
      throw new BadRequestException(
        'Solo se pueden crear jornadas en proyectos ACTIVOS',
      );
    }

    this.validarFechaDentroDelProyecto(dto.fecha, proyecto);

    if (!dto.metaId && (!dto.actividades || dto.actividades.length === 0)) {
      throw new BadRequestException(
        'Debe seleccionar una meta del plan para vincular formularios en campo',
      );
    }

    const tecnicoIds = this.resolverTecnicoIds(dto, usuarioActual);
    const tecnicos = await this.usuarioRepository.find({
      where: { id: In(tecnicoIds) },
    });
    if (tecnicos.length !== tecnicoIds.length) {
      throw new NotFoundException(
        'Uno o más usuarios técnicos no fueron encontrados',
      );
    }

    const personalIds = new Set((proyecto.personal ?? []).map((u) => u.id));
    if (dto.tecnicoResponsableIds?.length) {
      const fueraDePersonal = tecnicoIds.filter((id) => !personalIds.has(id));
      if (fueraDePersonal.length > 0) {
        throw new BadRequestException(
          'Solo se pueden asignar agentes que pertenezcan al personal del proyecto',
        );
      }
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

    const grupoJornadaId = tecnicoIds.length > 1 ? randomUUID() : null;
    const tecnicosPorId = new Map(tecnicos.map((t) => [t.id, t]));

    const idsGuardados = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Jornada);
      const creadas: string[] = [];

      for (const tecnicoId of tecnicoIds) {
        const tecnico = tecnicosPorId.get(tecnicoId)!;
        const jornada = repo.create({
          fecha: new Date(dto.fecha),
          nombre: dto.nombre?.trim() ? dto.nombre.trim() : null,
          observaciones: dto.observaciones,
          latitud: dto.latitud,
          longitud: dto.longitud,
          tipo: dto.tipo ?? TipoJornada.INDIVIDUAL,
          requiereRevision: dto.requiereRevision ?? true,
          proyecto: { id: dto.proyectoId },
          meta: dto.metaId ? ({ id: dto.metaId } as Meta) : null,
          vereda: { id: dto.veredaId },
          tecnicoResponsable: { id: tecnicoId },
          tecnicoResponsableNombre: tecnico.nombreCompleto,
          equipo: [{ id: tecnicoId }],
          jornadaActividades: lineas.map((linea) =>
            manager.getRepository(JornadaActividad).create({ ...linea }),
          ),
          grupoJornadaId,
        });
        const guardada = await repo.save(jornada);
        creadas.push(guardada.id);
      }

      return creadas;
    });

    for (const jornadaId of idsGuardados) {
      await this.cronologiaService.registrar({
        actorId: usuarioActual.id,
        proyectoId: dto.proyectoId,
        accion: 'JORNADA_CREADA',
        entidadTipo: 'jornada',
        entidadId: jornadaId,
        contextoTitulo: {
          nombreJornadaFecha: this.formatoFechaTitulo(dto.fecha),
        },
        detalle: detalleConOrigen('api'),
      });
    }

    const jornadas = await Promise.all(
      idsGuardados.map((id) => this.obtenerUna(id)),
    );

    return { grupoJornadaId, jornadas };
  }

  private resolverTecnicoIds(
    dto: CrearJornadaDto,
    usuarioActual: Usuario,
  ): string[] {
    if (dto.tecnicoResponsableIds?.length) {
      return [...new Set(dto.tecnicoResponsableIds)];
    }
    return [dto.tecnicoResponsableId ?? usuarioActual.id];
  }

  private async mapearHermanosGrupo(
    jornadas: Jornada[],
  ): Promise<Map<string, RespuestaHermanoGrupoDto[]>> {
    const grupoIds = [
      ...new Set(
        jornadas
          .map((j) => j.grupoJornadaId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const porGrupo = new Map<string, RespuestaHermanoGrupoDto[]>();
    if (!grupoIds.length) return porGrupo;

    const hermanas = await this.jornadaRepository.find({
      where: { grupoJornadaId: In(grupoIds) },
      relations: { tecnicoResponsable: true },
    });

    for (const hermana of hermanas) {
      if (!hermana.grupoJornadaId) continue;
      const lista = porGrupo.get(hermana.grupoJornadaId) ?? [];
      lista.push(aHermanoGrupo(hermana));
      porGrupo.set(hermana.grupoJornadaId, lista);
    }
    return porGrupo;
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
    const hermanosPorGrupo = await this.mapearHermanosGrupo(jornadas);
    const datos = jornadas.map((j) =>
      aRespuestaJornada(j, {
        grupo: j.grupoJornadaId
          ? hermanosPorGrupo.get(j.grupoJornadaId)
          : undefined,
      }),
    );
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
    const hermanosPorGrupo = await this.mapearHermanosGrupo(jornadas);
    const datos = jornadas.map((j) =>
      aRespuestaJornada(j, {
        grupo: j.grupoJornadaId
          ? hermanosPorGrupo.get(j.grupoJornadaId)
          : undefined,
      }),
    );
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

    const hermanosPorGrupo = await this.mapearHermanosGrupo([jornada]);

    return aRespuestaJornada(jornada, {
      enviosFormulario: envios,
      evidencias,
      metaEjecutadoTotal,
      grupo: jornada.grupoJornadaId
        ? hermanosPorGrupo.get(jornada.grupoJornadaId)
        : undefined,
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

    if (!estadoEditable(jornada.estadoFuncional)) {
      throw new BadRequestException(
        `La jornada está en ${jornada.estadoFuncional} y no se puede modificar. Espera la revisión o una solicitud de corrección.`,
      );
    }

    const objetivos = jornada.grupoJornadaId
      ? await this.jornadaRepository.find({
          where: { grupoJornadaId: jornada.grupoJornadaId },
          relations: { proyecto: true },
        })
      : [jornada];

    let metaValidada: Meta | null | undefined;
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

      if (
        meta.proceso.subactividad.actividad.proyecto.id !== jornada.proyecto.id
      ) {
        throw new BadRequestException(
          'La meta no pertenece al proyecto de la jornada',
        );
      }

      metaValidada = meta;
    }

    for (const objetivo of objetivos) {
      if (dto.fecha !== undefined) {
        this.validarFechaDentroDelProyecto(dto.fecha, objetivo.proyecto);
        objetivo.fecha = new Date(dto.fecha);
      }
      if (dto.nombre !== undefined) {
        objetivo.nombre = dto.nombre.trim() ? dto.nombre.trim() : null;
      }
      if (dto.observaciones !== undefined) {
        objetivo.observaciones = dto.observaciones;
      }
      if (dto.latitud !== undefined) objetivo.latitud = dto.latitud;
      if (dto.longitud !== undefined) objetivo.longitud = dto.longitud;
      if (dto.tipo !== undefined) objetivo.tipo = dto.tipo;
      if (dto.veredaId !== undefined) {
        objetivo.vereda = { id: dto.veredaId } as Jornada['vereda'];
      }
      if (metaValidada !== undefined) {
        objetivo.meta = { id: dto.metaId! } as Meta;
      }

      // cantidadEjecutada es por agente: solo en la jornada solicitada
      if (dto.cantidadEjecutada !== undefined && objetivo.id === id) {
        objetivo.cantidadEjecutada = dto.cantidadEjecutada;
      }
    }

    if (dto.actividades !== undefined) {
      for (const objetivo of objetivos) {
        await this.jornadaActividadRepository.delete({
          jornada: { id: objetivo.id },
        });
        const lineas = await this.validarActividadesJornada(
          objetivo.proyecto.id,
          dto.actividades,
        );
        objetivo.jornadaActividades = lineas.map((linea) =>
          this.jornadaActividadRepository.create({
            ...linea,
            jornada: { id: objetivo.id },
          }),
        );
      }
    }

    await this.jornadaRepository.save(objetivos);
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

    const objetivos = jornada.grupoJornadaId
      ? await this.jornadaRepository.find({
          where: { grupoJornadaId: jornada.grupoJornadaId },
          relations: { proyecto: true },
        })
      : [jornada];

    for (const objetivo of objetivos) {
      if (objetivo.estado === EstadoJornada.CANCELADA) continue;

      objetivo.estado = EstadoJornada.CANCELADA;
      await this.jornadaRepository.save(objetivo);

      const fechaStr =
        objetivo.fecha instanceof Date
          ? objetivo.fecha.toISOString().slice(0, 10)
          : String(objetivo.fecha).slice(0, 10);

      await this.cronologiaService.registrar({
        actorId: usuarioActual.id,
        proyectoId: objetivo.proyecto.id,
        accion: 'JORNADA_CANCELADA',
        entidadTipo: 'jornada',
        entidadId: objetivo.id,
        contextoTitulo: {
          nombreJornadaFecha: this.formatoFechaTitulo(fechaStr),
        },
        detalle: detalleConOrigen('api'),
      });
    }

    return this.obtenerUna(id);
  }

  async eliminar(id: string, forzar = false): Promise<void> {
    const jornada = await this.jornadaRepository.findOne({ where: { id } });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    const objetivos = jornada.grupoJornadaId
      ? await this.jornadaRepository.find({
          where: { grupoJornadaId: jornada.grupoJornadaId },
        })
      : [jornada];

    const ids = objetivos.map((o) => o.id);

    if (!forzar) {
      for (const objetivo of objetivos) {
        const [envios, evidencias, documentos] = await Promise.all([
          this.envioRepository.count({
            where: { jornada: { id: objetivo.id } },
          }),
          this.evidenciaRepository.count({
            where: { jornada: { id: objetivo.id } },
          }),
          this.dataSource.query<{ count: string }[]>(
            `SELECT COUNT(*)::text AS count FROM documents WHERE jornada_id = $1`,
            [objetivo.id],
          ),
        ]);

        const totalDocumentos = Number(documentos[0]?.count ?? 0);

        if (envios > 0 || evidencias > 0 || totalDocumentos > 0) {
          throw new BadRequestException(
            'No se puede eliminar una jornada con formularios, evidencias o documentos de revisión. Confirma el borrado forzado para continuar.',
          );
        }
      }
    }

    await this.dataSource.transaction(async (manager) => {
      if (forzar) {
        await manager.query(
          `DELETE FROM respuestas_formulario WHERE envio_formulario_id IN (
             SELECT id FROM envios_formulario WHERE jornada_id = ANY($1::uuid[])
           )`,
          [ids],
        );
        await manager.query(
          `DELETE FROM envios_formulario WHERE jornada_id = ANY($1::uuid[])`,
          [ids],
        );
        await manager.query(
          `DELETE FROM evidencias WHERE jornada_id = ANY($1::uuid[])`,
          [ids],
        );
      }

      await manager.query(
        `DELETE FROM jornada_asistentes WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );
      await manager.query(
        `DELETE FROM jornada_equipo WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );
      await manager.query(
        `DELETE FROM jornada_beneficiarios WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );
      await manager.query(
        `DELETE FROM jornada_actividades WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );

      // Flujo de revisión / subida al proyecto
      await manager.query(
        `DELETE FROM approvals WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );
      await manager.query(
        `UPDATE rejections SET resolution_version_id = NULL
         WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );
      await manager.query(
        `DELETE FROM rejections WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );
      await manager.query(
        `DELETE FROM audit_logs WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );
      await manager.query(
        `UPDATE documents SET version_vigente_id = NULL
         WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );
      await manager.query(
        `DELETE FROM document_versions WHERE document_id IN (
           SELECT id FROM documents WHERE jornada_id = ANY($1::uuid[])
         )`,
        [ids],
      );
      await manager.query(
        `DELETE FROM documents WHERE jornada_id = ANY($1::uuid[])`,
        [ids],
      );

      await manager.query(
        `DELETE FROM eventos_cronologia
         WHERE entidad_tipo = 'jornada' AND entidad_id = ANY($1::uuid[])`,
        [ids],
      );

      await manager.query(`DELETE FROM jornadas WHERE id = ANY($1::uuid[])`, [
        ids,
      ]);
    });
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
        tecnicoResponsable: true,
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
      unidadMedida: jornada.meta?.unidadMedida ?? null,
      cantidadEjecutada:
        jornada.cantidadEjecutada != null
          ? Number(jornada.cantidadEjecutada)
          : null,
      tecnicoNombre:
        jornada.tecnicoResponsableNombre ||
        jornada.tecnicoResponsable?.nombreCompleto ||
        null,
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
          tipoCampo: campo.tipoCampo,
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

  async generarPdfFormulario(jornadaId: string): Promise<Buffer> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId },
      relations: {
        proyecto: true,
        vereda: true,
        meta: { proceso: true },
        tecnicoResponsable: true,
      },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }

    if (jornada.tipo === TipoJornada.GRUPAL) {
      throw new BadRequestException(
        'Para jornadas grupales usa el PDF de lista de asistencia',
      );
    }

    const envios = await this.envioRepository.find({
      where: { jornada: { id: jornadaId } },
      relations: { plantillaFormulario: { campos: true } },
      order: { enviadoEn: 'ASC', indiceFila: 'ASC' },
    });

    const basePdf = {
      proyectoNombre: jornada.proyecto?.nombre ?? 'Proyecto',
      tituloDocumento: 'REPORTE DE FORMULARIO',
      fecha: jornada.fecha,
      veredaNombre: jornada.vereda?.nombre,
      metaNombre: jornada.meta?.nombre,
      unidadMedida: jornada.meta?.unidadMedida ?? null,
      cantidadEjecutada:
        jornada.cantidadEjecutada != null
          ? Number(jornada.cantidadEjecutada)
          : null,
      tecnicoNombre:
        jornada.tecnicoResponsableNombre ||
        jornada.tecnicoResponsable?.nombreCompleto ||
        null,
      observaciones: jornada.observaciones,
    };

    if (envios.length === 0) {
      return generarPdfAsistenciaJornada({
        ...basePdf,
        plantillaNombre: 'Formulario de campo',
        resumenPie: 'sin respuestas',
        cabecera: [
          {
            etiqueta: 'Estado del formulario',
            valor: 'Sin respuestas registradas aún',
          },
        ],
        tablas: [],
      });
    }

    const cabecera: Array<{
      etiqueta: string;
      valor: string | null;
      esFirma?: boolean;
      tipoCampo?: string;
    }> = [];
    const tablas: Array<{
      titulo?: string;
      columnas: Array<{ clave: string; etiqueta: string; esFirma?: boolean }>;
      filas: Array<Record<string, string | null>>;
    }> = [];

    const variosEnvios = envios.length > 1;
    let totalRespuestas = 0;

    for (const envio of envios) {
      const plantilla = envio.plantillaFormulario;
      if (!plantilla) continue;

      const campos = (plantilla.campos ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden);
      const camposTabla = campos.filter((c) => c.tipoCampo === TipoCampo.TABLA);
      const camposSimples = campos.filter(
        (c) => c.tipoCampo !== TipoCampo.TABLA,
      );

      const respuestas = await this.respuestaRepository.find({
        where: { envioFormulario: { id: envio.id } },
      });

      const prefijo = variosEnvios
        ? `${plantilla.nombre}${
            envio.indiceFila > 0 ? ` · fila ${envio.indiceFila + 1}` : ''
          }`
        : '';

      for (const campo of camposSimples) {
        const resp = respuestas.find((r) => r.claveCampo === campo.clave);
        cabecera.push({
          etiqueta: prefijo
            ? `${prefijo} · ${campo.etiqueta}`
            : campo.etiqueta,
          valor: resp ? this.valorRespuestaTexto(resp) : null,
          esFirma: campo.tipoCampo === TipoCampo.FIRMA,
          tipoCampo: campo.tipoCampo,
        });
        if (resp) totalRespuestas += 1;
      }

      for (const campoTabla of camposTabla) {
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

        tablas.push({
          titulo: prefijo
            ? `${prefijo} · ${campoTabla.etiqueta}`
            : campoTabla.etiqueta,
          columnas: columnasDef.map((c) => ({
            clave: c.clave,
            etiqueta: c.etiqueta,
            esFirma: c.tipoCampo === 'FIRMA',
          })),
          filas,
        });
        totalRespuestas += filas.length;
      }
    }

    const primeraPlantilla = envios[0]?.plantillaFormulario?.nombre;

    return generarPdfAsistenciaJornada({
      ...basePdf,
      plantillaNombre:
        envios.length === 1 && primeraPlantilla
          ? primeraPlantilla
          : `${envios.length} envío(s) de formulario`,
      resumenPie: `${totalRespuestas} respuesta(s)`,
      cabecera:
        cabecera.length > 0
          ? cabecera
          : [
              {
                etiqueta: 'Estado del formulario',
                valor: 'Sin campos de respuesta en los envíos',
              },
            ],
      tablas,
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
    if (resp.valorBooleano != null) return resp.valorBooleano ? 'Sí' : 'No';
    if (resp.valorTexto != null) {
      const texto = resp.valorTexto.trim();
      if (texto.startsWith('[')) {
        try {
          const parsed = JSON.parse(texto) as unknown;
          if (Array.isArray(parsed)) {
            return parsed.map((v) => String(v)).filter(Boolean).join(', ');
          }
        } catch {
          // texto plano
        }
      }
      return resp.valorTexto;
    }
    if (resp.valorNumero != null) return String(resp.valorNumero);
    if (resp.valorFecha != null) return resp.valorFecha.toISOString().slice(0, 10);
    if (resp.valorJson != null) {
      if (Array.isArray(resp.valorJson)) {
        return resp.valorJson.map((v) => String(v)).filter(Boolean).join(', ');
      }
      return JSON.stringify(resp.valorJson);
    }
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

  private aDiaIso(valor: string | Date): string {
    if (typeof valor === 'string') {
      return valor.slice(0, 10);
    }
    const anio = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private validarFechaDentroDelProyecto(
    fecha: string,
    proyecto: Pick<Proyecto, 'fechaInicio' | 'fechaFin'>,
  ): void {
    const dia = this.aDiaIso(fecha);

    if (proyecto.fechaInicio) {
      const inicio = this.aDiaIso(proyecto.fechaInicio);
      if (dia < inicio) {
        throw new BadRequestException(
          `La fecha de la jornada no puede ser anterior al inicio del proyecto (${this.formatoFechaTitulo(inicio)})`,
        );
      }
    }

    if (proyecto.fechaFin) {
      const fin = this.aDiaIso(proyecto.fechaFin);
      if (dia > fin) {
        throw new BadRequestException(
          `La fecha de la jornada no puede ser posterior al fin del proyecto (${this.formatoFechaTitulo(fin)})`,
        );
      }
    }
  }
}
