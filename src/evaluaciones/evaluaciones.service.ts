import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Rejection } from '../aprobaciones/entities/rejection.entity';
import { Meta } from '../actividades/entities/meta.entity';
import { MetaPeriodo } from '../actividades/entities/meta-periodo.entity';
import { EstadoFuncional } from '../common/workflow/estado-funcional.enum';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { TipoEvidencia } from '../evidencias/enums/tipo-evidencia.enum';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { EstadoJornada } from '../jornadas/enums/estado-jornada.enum';
import { sumarEjecutadoPorMetaYUsuario } from '../jornadas/utils/calcular-ejecutado-meta';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { EstadoProyecto } from '../proyectos/enums/estado-proyecto.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  FiltrosAsignacionMetaDto,
  FiltrosProductividadDto,
  UpsertAsignacionesMetaDto,
} from './dto/asignacion-meta.dto';
import {
  ProductividadPersonaDto,
  ProductividadUsuarioDetalleDto,
  RespuestaAsignacionMetaDto,
  ResumenDesviacionesDto,
  SugerenciaRepartoDto,
} from './dto/respuesta-asignacion.dto';
import { AsignacionMeta } from './entities/asignacion-meta.entity';
import { generarPdfReporteEvaluaciones } from './utils/generar-pdf-evaluaciones';
import { generarPdfFichaIndividual } from './utils/generar-pdf-ficha-individual';

const NOMBRES_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Injectable()
export class EvaluacionesService {
  constructor(
    @InjectRepository(AsignacionMeta)
    private readonly asignacionRepository: Repository<AsignacionMeta>,
    @InjectRepository(Meta)
    private readonly metaRepository: Repository<Meta>,
    @InjectRepository(MetaPeriodo)
    private readonly periodoRepository: Repository<MetaPeriodo>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
    @InjectRepository(Rejection)
    private readonly rejectionRepository: Repository<Rejection>,
  ) {}

  async upsertBatch(
    proyectoId: string,
    dto: UpsertAsignacionesMetaDto,
  ): Promise<RespuestaAsignacionMetaDto[]> {
    const proyecto = await this.cargarProyectoConPersonal(proyectoId);
    const meta = await this.cargarMetaDeProyecto(dto.metaId, proyectoId);

    let periodo: MetaPeriodo | null = null;
    if (dto.metaPeriodoId) {
      periodo = await this.periodoRepository.findOne({
        where: { id: dto.metaPeriodoId, meta: { id: meta.id } },
      });
      if (!periodo) {
        throw new BadRequestException(
          'El periodo no pertenece a la meta indicada',
        );
      }
    }

    const personalIds = new Set((proyecto.personal ?? []).map((u) => u.id));
    const usuarioIds = dto.asignaciones.map((a) => a.usuarioId);
    const usuarios = await this.usuarioRepository.find({
      where: { id: In(usuarioIds) },
    });
    if (usuarios.length !== usuarioIds.length) {
      throw new BadRequestException('Uno o más usuarios no existen');
    }
    for (const u of usuarios) {
      if (!personalIds.has(u.id)) {
        throw new BadRequestException(
          `El usuario ${u.nombreCompleto} no está en el personal del proyecto`,
        );
      }
    }

    const mapaUsuarios = new Map(usuarios.map((u) => [u.id, u]));
    const guardadas: AsignacionMeta[] = [];

    for (const item of dto.asignaciones) {
      const existente = await this.asignacionRepository.findOne({
        where: {
          meta: { id: meta.id },
          usuario: { id: item.usuarioId },
          metaPeriodo: periodo ? { id: periodo.id } : IsNull(),
        },
        relations: { meta: true, usuario: true, metaPeriodo: true },
      });

      if (existente) {
        existente.cantidadAsignada = item.cantidadAsignada;
        existente.notas = item.notas ?? existente.notas;
        guardadas.push(await this.asignacionRepository.save(existente));
      } else {
        const nueva = this.asignacionRepository.create({
          meta,
          usuario: mapaUsuarios.get(item.usuarioId)!,
          metaPeriodo: periodo,
          cantidadAsignada: item.cantidadAsignada,
          notas: item.notas ?? null,
        });
        guardadas.push(await this.asignacionRepository.save(nueva));
      }
    }

    return Promise.all(
      guardadas.map((a) => this.enriquecerAsignacion(a, proyectoId)),
    );
  }

  async listarPorProyecto(
    proyectoId: string,
    filtros: FiltrosAsignacionMetaDto,
  ): Promise<RespuestaAsignacionMetaDto[]> {
    await this.asegurarProyecto(proyectoId);

    const qb = this.asignacionRepository
      .createQueryBuilder('asig')
      .innerJoinAndSelect('asig.meta', 'meta')
      .innerJoinAndSelect('meta.proceso', 'proceso')
      .innerJoinAndSelect('proceso.subactividad', 'sub')
      .innerJoinAndSelect('sub.actividad', 'actividad')
      .innerJoinAndSelect('asig.usuario', 'usuario')
      .leftJoinAndSelect('asig.metaPeriodo', 'periodo')
      .where('actividad.proyecto_id = :proyectoId', { proyectoId });

    if (filtros.metaId) {
      qb.andWhere('meta.id = :metaId', { metaId: filtros.metaId });
    }
    if (filtros.anio != null && filtros.mes != null) {
      qb.andWhere('periodo.anio = :anio', { anio: filtros.anio }).andWhere(
        'periodo.mes = :mes',
        { mes: filtros.mes },
      );
    } else if (filtros.metaId) {
      qb.andWhere('periodo.id IS NULL');
    }

    const filas = await qb.getMany();
    return Promise.all(
      filas.map((a) => this.enriquecerAsignacion(a, proyectoId)),
    );
  }

  async sugerirReparto(
    proyectoId: string,
    metaId: string,
    metaPeriodoId?: string,
  ): Promise<SugerenciaRepartoDto[]> {
    const proyecto = await this.cargarProyectoConPersonal(proyectoId);
    const meta = await this.cargarMetaDeProyecto(metaId, proyectoId);

    let periodo: MetaPeriodo | null = null;
    let anio: number | undefined;
    let mes: number | undefined;
    if (metaPeriodoId) {
      periodo = await this.periodoRepository.findOne({
        where: { id: metaPeriodoId, meta: { id: meta.id } },
      });
      if (!periodo) {
        throw new BadRequestException('Periodo inválido para la meta');
      }
      anio = periodo.anio;
      mes = periodo.mes;
    }

    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .innerJoin('jornada.tecnicoResponsable', 'tecnico')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('jornada.meta_id = :metaId', { metaId })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .select('tecnico.id', 'usuarioId')
      .addSelect('tecnico.nombre_completo', 'nombreCompleto')
      .addSelect('tecnico.correo', 'correo')
      .addSelect('COUNT(*)', 'conteo')
      .groupBy('tecnico.id')
      .addGroupBy('tecnico.nombre_completo')
      .addGroupBy('tecnico.correo');

    if (anio != null && mes != null) {
      const inicio = new Date(anio, mes - 1, 1);
      const fin = new Date(anio, mes, 0);
      qb.andWhere('jornada.fecha >= :inicio', { inicio }).andWhere(
        'jornada.fecha <= :fin',
        { fin },
      );
    }

    const participantes = await qb.getRawMany<{
      usuarioId: string;
      nombreCompleto: string;
      correo: string;
      conteo: string;
    }>();

    const personalIds = new Set((proyecto.personal ?? []).map((u) => u.id));
    const filtrados = participantes.filter((p) => personalIds.has(p.usuarioId));

    const base =
      periodo != null
        ? Number(periodo.cantidadPlaneada)
        : Number(meta.cantidadTotal);
    const n = filtrados.length || 1;
    const porPersona = Math.round((base / n) * 100) / 100;

    if (filtrados.length === 0) {
      return (proyecto.personal ?? []).map((u) => ({
        usuario: {
          id: u.id,
          nombreCompleto: u.nombreCompleto,
          correo: u.correo,
        },
        conteoJornadas: 0,
        cantidadSugerida:
          Math.round(
            (base / Math.max(proyecto.personal?.length ?? 1, 1)) * 100,
          ) / 100,
      }));
    }

    return filtrados.map((p) => ({
      usuario: {
        id: p.usuarioId,
        nombreCompleto: p.nombreCompleto,
        correo: p.correo,
      },
      conteoJornadas: Number(p.conteo),
      cantidadSugerida: porPersona,
    }));
  }

  async productividadProyecto(
    proyectoId: string,
    filtros: FiltrosProductividadDto,
  ): Promise<ProductividadPersonaDto[]> {
    await this.asegurarProyecto(proyectoId);
    const anio = filtros.anio ?? new Date().getFullYear();
    const mes = filtros.mes ?? new Date().getMonth() + 1;

    const asignaciones = await this.listarPorProyecto(proyectoId, {
      anio,
      mes,
    });

    const porUsuario = new Map<string, ProductividadPersonaDto>();

    for (const a of asignaciones) {
      const actual = this.basePersona(
        a.usuario.id,
        a.usuario.nombreCompleto,
        proyectoId,
      );
      const prev = porUsuario.get(a.usuario.id) ?? actual;
      prev.cantidadAsignada += a.cantidadAsignada;
      prev.ejecutado += a.ejecutado;
      porUsuario.set(a.usuario.id, prev);
    }

    // Incluir técnicos con jornadas aunque no tengan cuota asignada
    const activos = await this.tecnicosActivosEnPeriodo(proyectoId, anio, mes);
    for (const t of activos) {
      if (!porUsuario.has(t.usuarioId)) {
        porUsuario.set(
          t.usuarioId,
          this.basePersona(t.usuarioId, t.nombreCompleto, proyectoId),
        );
      }
    }

    const resultado: ProductividadPersonaDto[] = [];
    for (const p of porUsuario.values()) {
      resultado.push(
        await this.completarMetricasAgente(p, proyectoId, anio, mes),
      );
    }

    return this.ordenarPorEficiencia(resultado);
  }

  async cumplimientoEquipoGlobal(
    anio?: number,
    mes?: number,
    limite = 10,
  ): Promise<ProductividadPersonaDto[]> {
    const completo = await this.equipoGlobalCompleto(anio, mes);
    return completo.slice(0, limite);
  }

  private async equipoGlobalCompleto(
    anio?: number,
    mes?: number,
  ): Promise<ProductividadPersonaDto[]> {
    const a = anio ?? new Date().getFullYear();
    const m = mes ?? new Date().getMonth() + 1;

    const proyectos = await this.proyectoRepository.find({
      where: { estado: EstadoProyecto.ACTIVO },
      select: { id: true, nombre: true },
    });

    const mapa = new Map<string, ProductividadPersonaDto>();

    for (const p of proyectos) {
      const ranking = await this.productividadProyecto(p.id, {
        anio: a,
        mes: m,
      });
      for (const r of ranking) {
        const actual = mapa.get(r.usuarioId) ?? {
          ...this.basePersona(r.usuarioId, r.nombreCompleto),
          proyectoId: p.id,
          proyectoNombre: p.nombre,
        };
        actual.cantidadAsignada += r.cantidadAsignada;
        actual.ejecutado += r.ejecutado;
        actual.conteoJornadas += r.conteoJornadas;
        actual.jornadasAprobadas += r.jornadasAprobadas;
        actual.jornadasConEvidencia += r.jornadasConEvidencia;
        actual.formulariosEnviados += r.formulariosEnviados;
        actual.rechazosRevision =
          (actual.rechazosRevision ?? 0) + (r.rechazosRevision ?? 0);
        actual.beneficiariosAtendidos += r.beneficiariosAtendidos;
        actual.veredasCubiertas += r.veredasCubiertas;
        if (!actual.proyectoNombre) {
          actual.proyectoId = p.id;
          actual.proyectoNombre = p.nombre;
        }
        mapa.set(r.usuarioId, actual);
      }
    }

    const enriquecidos = [...mapa.values()].map((p) => {
      p.cumplimientoPorcentaje =
        p.cantidadAsignada > 0
          ? Math.round((p.ejecutado / p.cantidadAsignada) * 1000) / 10
          : 0;
      p.promedioBeneficiariosPorJornada =
        p.conteoJornadas > 0
          ? Math.round((p.beneficiariosAtendidos / p.conteoJornadas) * 10) / 10
          : 0;
      p.ritmoEjecucion =
        p.conteoJornadas > 0
          ? Math.round((p.ejecutado / p.conteoJornadas) * 10) / 10
          : 0;
      return p;
    });

    return this.ordenarPorEficiencia(enriquecidos).filter(
      (p) => p.conteoJornadas > 0 || p.cantidadAsignada > 0,
    );
  }

  private basePersona(
    usuarioId: string,
    nombreCompleto: string,
    proyectoId?: string,
  ): ProductividadPersonaDto {
    return {
      usuarioId,
      nombreCompleto,
      cantidadAsignada: 0,
      ejecutado: 0,
      cumplimientoPorcentaje: 0,
      indiceEficiencia: 0,
      conteoJornadas: 0,
      jornadasAprobadas: 0,
      jornadasConEvidencia: 0,
      formulariosEnviados: 0,
      rechazosRevision: 0,
      beneficiariosAtendidos: 0,
      veredasCubiertas: 0,
      promedioBeneficiariosPorJornada: 0,
      ritmoEjecucion: 0,
      proyectoId,
    };
  }

  private async completarMetricasAgente(
    base: ProductividadPersonaDto,
    proyectoId: string,
    anio: number,
    mes: number,
  ): Promise<ProductividadPersonaDto> {
    const [
      conteoJornadas,
      jornadasAprobadas,
      jornadasConEvidencia,
      formulariosEnviados,
      rechazosRevision,
      beneficiariosAtendidos,
      veredasCubiertas,
    ] = await Promise.all([
      this.contarJornadasUsuario(base.usuarioId, proyectoId, anio, mes),
      this.contarJornadasAprobadas(base.usuarioId, proyectoId, anio, mes),
      this.contarJornadasConEvidencia(base.usuarioId, proyectoId, anio, mes),
      this.contarFormulariosUsuario(base.usuarioId, proyectoId, anio, mes),
      this.contarRechazosRevision(base.usuarioId, proyectoId, anio, mes),
      this.contarBeneficiariosUsuario(base.usuarioId, proyectoId, anio, mes),
      this.contarVeredasUsuario(proyectoId, base.usuarioId, anio, mes),
    ]);

    const cumplimientoPorcentaje =
      base.cantidadAsignada > 0
        ? Math.round((base.ejecutado / base.cantidadAsignada) * 1000) / 10
        : 0;

    return {
      ...base,
      cumplimientoPorcentaje,
      conteoJornadas,
      jornadasAprobadas,
      jornadasConEvidencia,
      formulariosEnviados,
      rechazosRevision,
      beneficiariosAtendidos,
      veredasCubiertas,
      promedioBeneficiariosPorJornada:
        conteoJornadas > 0
          ? Math.round((beneficiariosAtendidos / conteoJornadas) * 10) / 10
          : 0,
      ritmoEjecucion:
        conteoJornadas > 0
          ? Math.round((base.ejecutado / conteoJornadas) * 10) / 10
          : 0,
      indiceEficiencia: 0,
    };
  }

  private ordenarPorEficiencia(
    personas: ProductividadPersonaDto[],
  ): ProductividadPersonaDto[] {
    const maxJ = Math.max(...personas.map((p) => p.conteoJornadas), 1);
    const maxB = Math.max(...personas.map((p) => p.beneficiariosAtendidos), 1);
    const maxV = Math.max(...personas.map((p) => p.veredasCubiertas), 1);
    const maxF = Math.max(...personas.map((p) => p.formulariosEnviados), 1);

    return personas
      .map((p) => {
        const cumplimiento =
          p.cantidadAsignada > 0
            ? Math.min(p.cumplimientoPorcentaje, 120) / 1.2
            : p.conteoJornadas > 0
              ? 50
              : 0;
        const jornadas = (p.conteoJornadas / maxJ) * 100;
        const benef = (p.beneficiariosAtendidos / maxB) * 100;
        const veredas = (p.veredasCubiertas / maxV) * 100;
        const evid =
          p.conteoJornadas > 0
            ? (p.jornadasConEvidencia / p.conteoJornadas) * 100
            : 0;
        const forms = (p.formulariosEnviados / maxF) * 100;
        const calidad =
          p.conteoJornadas + p.formulariosEnviados > 0
            ? Math.max(
                0,
                100 -
                  (p.rechazosRevision / Math.max(p.conteoJornadas, 1)) * 100,
              )
            : 100;
        const indiceEficiencia = Math.round(
          cumplimiento * 0.28 +
            jornadas * 0.2 +
            benef * 0.16 +
            evid * 0.1 +
            veredas * 0.08 +
            forms * 0.08 +
            calidad * 0.1,
        );
        return { ...p, indiceEficiencia };
      })
      .sort((a, b) => b.indiceEficiencia - a.indiceEficiencia);
  }

  private async tecnicosActivosEnPeriodo(
    proyectoId: string,
    anio: number,
    mes: number,
  ): Promise<Array<{ usuarioId: string; nombreCompleto: string }>> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .innerJoin('jornada.tecnicoResponsable', 'tecnico')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .select('tecnico.id', 'usuarioId')
      .addSelect('tecnico.nombre_completo', 'nombreCompleto')
      .groupBy('tecnico.id')
      .addGroupBy('tecnico.nombre_completo');
    this.aplicarPeriodo(qb, anio, mes);
    return qb.getRawMany<{ usuarioId: string; nombreCompleto: string }>();
  }

  private async contarJornadasAprobadas(
    usuarioId: string,
    proyectoId: string,
    anio: number,
    mes: number,
  ): Promise<number> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
      .andWhere('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .andWhere('jornada.estado_funcional = :aprobado', {
        aprobado: EstadoFuncional.APROBADO,
      });
    this.aplicarPeriodo(qb, anio, mes);
    return qb.getCount();
  }

  private async contarJornadasConEvidencia(
    usuarioId: string,
    proyectoId: string,
    anio: number,
    mes: number,
  ): Promise<number> {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0);
    const raw = await this.evidenciaRepository
      .createQueryBuilder('evidencia')
      .innerJoin('evidencia.jornada', 'jornada')
      .where('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
      .andWhere('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .andWhere('evidencia.tipo = :tipo', { tipo: TipoEvidencia.FOTO })
      .andWhere('jornada.fecha >= :inicioPeriodo', { inicioPeriodo: inicio })
      .andWhere('jornada.fecha <= :finPeriodo', { finPeriodo: fin })
      .select('COUNT(DISTINCT jornada.id)', 'total')
      .getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  private async contarFormulariosUsuario(
    usuarioId: string,
    proyectoId: string,
    anio: number,
    mes: number,
  ): Promise<number> {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);
    return this.envioRepository
      .createQueryBuilder('envio')
      .innerJoin('envio.jornada', 'jornada')
      .where('envio.usuario_id = :usuarioId', { usuarioId })
      .andWhere('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('envio.enviado_en >= :inicio', { inicio })
      .andWhere('envio.enviado_en <= :fin', { fin })
      .getCount();
  }

  /**
   * Rechazos en revisión del trabajo del técnico (jornada, documento/formulario o evidencia).
   * Los envíos no se rechazan uno a uno: se rechaza la jornada o el documento asociado.
   */
  private async contarRechazosRevision(
    usuarioId: string,
    proyectoId?: string,
    anio?: number,
    mes?: number,
  ): Promise<number> {
    const qb = this.rejectionRepository
      .createQueryBuilder('rechazo')
      .innerJoin(Jornada, 'jornada', 'jornada.id = rechazo.jornada_id')
      .where('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      });

    if (proyectoId) {
      qb.andWhere('jornada.proyecto_id = :proyectoId', { proyectoId });
    }

    if (anio != null && mes != null) {
      const inicio = new Date(anio, mes - 1, 1);
      const fin = new Date(anio, mes, 0, 23, 59, 59);
      qb.andWhere('rechazo.rejected_at >= :inicio', { inicio }).andWhere(
        'rechazo.rejected_at <= :fin',
        { fin },
      );
    }

    return qb.getCount();
  }

  async productividadUsuario(
    usuarioId: string,
    filtros: FiltrosProductividadDto,
  ): Promise<ProductividadUsuarioDetalleDto> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);
    }

    const anio = filtros.anio;
    const mes = filtros.mes;

    const qb = this.asignacionRepository
      .createQueryBuilder('asig')
      .innerJoinAndSelect('asig.meta', 'meta')
      .innerJoinAndSelect('meta.proceso', 'proceso')
      .innerJoinAndSelect('proceso.subactividad', 'sub')
      .innerJoinAndSelect('sub.actividad', 'actividad')
      .innerJoinAndSelect('actividad.proyecto', 'proyecto')
      .innerJoinAndSelect('asig.usuario', 'u')
      .leftJoinAndSelect('asig.metaPeriodo', 'periodo')
      .where('u.id = :usuarioId', { usuarioId });

    if (filtros.proyectoId) {
      qb.andWhere('proyecto.id = :proyectoId', {
        proyectoId: filtros.proyectoId,
      });
    }
    if (anio != null && mes != null) {
      qb.andWhere('periodo.anio = :anio', { anio }).andWhere(
        'periodo.mes = :mes',
        { mes },
      );
    }

    const filas = await qb.getMany();
    const asignaciones = await Promise.all(
      filas.map((a) =>
        this.enriquecerAsignacion(
          a,
          a.meta.proceso.subactividad.actividad.proyecto.id,
        ),
      ),
    );

    const totalAsignado = asignaciones.reduce(
      (s, a) => s + a.cantidadAsignada,
      0,
    );
    const totalEjecutado = asignaciones.reduce((s, a) => s + a.ejecutado, 0);
    const cumplimientoPromedio =
      asignaciones.length > 0
        ? Math.round(
            (asignaciones.reduce((s, a) => s + a.cumplimientoPorcentaje, 0) /
              asignaciones.length) *
              10,
          ) / 10
        : 0;

    const proyectoId = filtros.proyectoId;
    const conteoJornadas = await this.contarJornadasUsuario(
      usuarioId,
      proyectoId,
      anio,
      mes,
    );
    const beneficiariosAtendidos = await this.contarBeneficiariosUsuario(
      usuarioId,
      proyectoId,
      anio,
      mes,
    );
    const veredasCubiertas = proyectoId
      ? await this.contarVeredasUsuario(proyectoId, usuarioId, anio, mes)
      : await this.contarVeredasUsuarioGlobal(usuarioId, anio, mes);
    const rechazosRevision = await this.contarRechazosRevision(
      usuarioId,
      proyectoId,
      anio,
      mes,
    );

    return {
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
      },
      asignaciones,
      totalAsignado,
      totalEjecutado,
      cumplimientoPromedio,
      conteoJornadas,
      beneficiariosAtendidos,
      veredasCubiertas,
      rechazosRevision,
    };
  }

  /**
   * Fallos / incumplimientos del periodo respecto a la cuota personal asignada.
   * Base para evaluación individual (cuántas metas no se cumplieron vs planeación).
   */
  async desviacionesVsPlaneacion(
    usuarioId: string,
    filtros: FiltrosProductividadDto,
  ): Promise<ResumenDesviacionesDto> {
    const anio = filtros.anio ?? new Date().getFullYear();
    const mes = filtros.mes ?? new Date().getMonth() + 1;
    const detalleUsuario = await this.productividadUsuario(usuarioId, {
      ...filtros,
      anio,
      mes,
    });

    const detalle = detalleUsuario.asignaciones
      .filter((a) => a.cantidadAsignada > 0)
      .map((a) => {
        const sinEjecucion = a.ejecutado <= 0;
        const incumplida = a.cumplimientoPorcentaje < 100;
        return {
          metaId: a.metaId,
          metaNombre: a.metaNombre,
          unidadMedida: a.unidadMedida,
          cantidadAsignada: a.cantidadAsignada,
          ejecutado: a.ejecutado,
          cumplimientoPorcentaje: a.cumplimientoPorcentaje,
          sinEjecucion,
          incumplida,
        };
      });

    return {
      usuario: detalleUsuario.usuario,
      anio,
      mes,
      metasConCuota: detalle.length,
      fallosSinEjecucion: detalle.filter((d) => d.sinEjecucion).length,
      incumplimientos: detalle.filter((d) => d.incumplida).length,
      detalle,
    };
  }

  private async enriquecerAsignacion(
    asig: AsignacionMeta,
    proyectoId: string,
  ): Promise<RespuestaAsignacionMetaDto> {
    const anio = asig.metaPeriodo?.anio;
    const mes = asig.metaPeriodo?.mes;
    const opciones = anio != null && mes != null ? { anio, mes } : undefined;

    const ejecutado = await sumarEjecutadoPorMetaYUsuario(
      this.jornadaRepository,
      asig.meta.id,
      asig.usuario.id,
      opciones,
    );

    const cantidadAsignada = Number(asig.cantidadAsignada);
    const cumplimientoPorcentaje =
      cantidadAsignada > 0
        ? Math.round((ejecutado / cantidadAsignada) * 1000) / 10
        : 0;

    const conteoJornadas = await this.contarJornadasMetaUsuario(
      proyectoId,
      asig.meta.id,
      asig.usuario.id,
      anio,
      mes,
    );
    const beneficiariosAtendidos = await this.contarBeneficiariosMetaUsuario(
      proyectoId,
      asig.meta.id,
      asig.usuario.id,
      anio,
      mes,
    );

    return {
      id: asig.id,
      metaId: asig.meta.id,
      metaNombre: asig.meta.nombre,
      unidadMedida: asig.meta.unidadMedida,
      metaPeriodoId: asig.metaPeriodo?.id ?? null,
      anio: anio ?? null,
      mes: mes ?? null,
      usuario: {
        id: asig.usuario.id,
        nombreCompleto: asig.usuario.nombreCompleto,
        correo: asig.usuario.correo,
      },
      cantidadAsignada,
      ejecutado,
      cumplimientoPorcentaje,
      conteoJornadas,
      beneficiariosAtendidos,
      notas: asig.notas,
    };
  }

  private async cargarProyectoConPersonal(
    proyectoId: string,
  ): Promise<Proyecto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
      relations: { personal: true },
    });
    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }
    return proyecto;
  }

  private async asegurarProyecto(proyectoId: string): Promise<void> {
    const existe = await this.proyectoRepository.exists({
      where: { id: proyectoId },
    });
    if (!existe) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }
  }

  private async cargarMetaDeProyecto(
    metaId: string,
    proyectoId: string,
  ): Promise<Meta> {
    const meta = await this.metaRepository.findOne({
      where: { id: metaId },
      relations: {
        proceso: { subactividad: { actividad: { proyecto: true } } },
      },
    });
    if (!meta) {
      throw new NotFoundException(`Meta ${metaId} no encontrada`);
    }
    const pid = meta.proceso?.subactividad?.actividad?.proyecto?.id;
    if (pid !== proyectoId) {
      throw new BadRequestException(
        'La meta no pertenece al proyecto indicado',
      );
    }
    return meta;
  }

  private async contarJornadasMetaUsuario(
    proyectoId: string,
    metaId: string,
    usuarioId: string,
    anio?: number | null,
    mes?: number | null,
  ): Promise<number> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('jornada.meta_id = :metaId', { metaId })
      .andWhere('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .andWhere('jornada.estado_funcional = :aprobado', {
        aprobado: EstadoFuncional.APROBADO,
      });
    this.aplicarPeriodo(qb, anio, mes);
    return qb.getCount();
  }

  private async contarBeneficiariosMetaUsuario(
    proyectoId: string,
    metaId: string,
    usuarioId: string,
    anio?: number | null,
    mes?: number | null,
  ): Promise<number> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .innerJoin('jornada.beneficiarios', 'b')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('jornada.meta_id = :metaId', { metaId })
      .andWhere('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .select('COUNT(DISTINCT b.id)', 'total');
    this.aplicarPeriodo(qb, anio, mes);
    const raw = await qb.getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  private async contarJornadasUsuario(
    usuarioId: string,
    proyectoId?: string,
    anio?: number,
    mes?: number,
  ): Promise<number> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      });
    if (proyectoId) {
      qb.andWhere('jornada.proyecto_id = :proyectoId', { proyectoId });
    }
    this.aplicarPeriodo(qb, anio, mes);
    return qb.getCount();
  }

  private async contarBeneficiariosUsuario(
    usuarioId: string,
    proyectoId?: string,
    anio?: number,
    mes?: number,
  ): Promise<number> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .innerJoin('jornada.beneficiarios', 'b')
      .where('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .select('COUNT(DISTINCT b.id)', 'total');
    if (proyectoId) {
      qb.andWhere('jornada.proyecto_id = :proyectoId', { proyectoId });
    }
    this.aplicarPeriodo(qb, anio, mes);
    const raw = await qb.getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  private async contarVeredasUsuario(
    proyectoId: string,
    usuarioId: string,
    anio?: number,
    mes?: number,
  ): Promise<number> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
      .andWhere('jornada.vereda_id IS NOT NULL')
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .select('COUNT(DISTINCT jornada.vereda_id)', 'total');
    this.aplicarPeriodo(qb, anio, mes);
    const raw = await qb.getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  private async contarVeredasUsuarioGlobal(
    usuarioId: string,
    anio?: number,
    mes?: number,
  ): Promise<number> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
      .andWhere('jornada.vereda_id IS NOT NULL')
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .select('COUNT(DISTINCT jornada.vereda_id)', 'total');
    this.aplicarPeriodo(qb, anio, mes);
    const raw = await qb.getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  async generarPdfReporte(
    filtros: FiltrosProductividadDto,
    generadoPor?: string,
  ): Promise<Buffer> {
    const anio = filtros.anio ?? new Date().getFullYear();
    const mes = filtros.mes ?? new Date().getMonth() + 1;

    let ranking: ProductividadPersonaDto[];
    let proyectoNombre: string | null = null;

    if (filtros.proyectoId) {
      const proyecto = await this.proyectoRepository.findOne({
        where: { id: filtros.proyectoId },
        select: { id: true, nombre: true },
      });
      if (!proyecto) {
        throw new NotFoundException(
          `Proyecto ${filtros.proyectoId} no encontrado`,
        );
      }
      proyectoNombre = proyecto.nombre;
      ranking = await this.productividadProyecto(filtros.proyectoId, {
        anio,
        mes,
      });
    } else {
      ranking = await this.equipoGlobalCompleto(anio, mes);
    }

    return generarPdfReporteEvaluaciones({
      anio,
      mes,
      nombreMes: NOMBRES_MES[mes - 1] ?? String(mes),
      proyectoNombre,
      generadoPor,
      filas: ranking.map((r, i) => ({
        puesto: i + 1,
        nombreCompleto: r.nombreCompleto,
        proyectoNombre: filtros.proyectoId ? null : r.proyectoNombre,
        indiceEficiencia: r.indiceEficiencia,
        cumplimientoPorcentaje: r.cumplimientoPorcentaje,
        conteoJornadas: r.conteoJornadas,
        jornadasAprobadas: r.jornadasAprobadas,
        beneficiariosAtendidos: r.beneficiariosAtendidos,
        veredasCubiertas: r.veredasCubiertas,
        jornadasConEvidencia: r.jornadasConEvidencia,
        rechazosRevision: r.rechazosRevision ?? 0,
        ritmoEjecucion: r.ritmoEjecucion,
      })),
    });
  }

  async generarPdfFicha(
    usuarioId: string,
    filtros: FiltrosProductividadDto,
    generadoPor?: string,
  ): Promise<Buffer> {
    const anio = filtros.anio ?? new Date().getFullYear();
    const mes = filtros.mes ?? new Date().getMonth() + 1;

    const [detalle, desviaciones, proyecto] = await Promise.all([
      this.productividadUsuario(usuarioId, { ...filtros, anio, mes }),
      this.desviacionesVsPlaneacion(usuarioId, { ...filtros, anio, mes }),
      filtros.proyectoId
        ? this.proyectoRepository.findOne({
            where: { id: filtros.proyectoId },
            select: { id: true, nombre: true },
          })
        : Promise.resolve(null),
    ]);

    return generarPdfFichaIndividual({
      nombreCompleto: detalle.usuario.nombreCompleto,
      correo: detalle.usuario.correo,
      anio,
      mes,
      nombreMes: NOMBRES_MES[mes - 1] ?? String(mes),
      proyectoNombre: proyecto?.nombre ?? null,
      generadoPor,
      cumplimientoPromedio: detalle.cumplimientoPromedio,
      totalAsignado: detalle.totalAsignado,
      totalEjecutado: detalle.totalEjecutado,
      conteoJornadas: detalle.conteoJornadas,
      beneficiariosAtendidos: detalle.beneficiariosAtendidos,
      veredasCubiertas: detalle.veredasCubiertas,
      rechazosRevision: detalle.rechazosRevision ?? 0,
      asignaciones: detalle.asignaciones.map((a) => ({
        metaNombre: a.metaNombre,
        unidadMedida: a.unidadMedida,
        periodo:
          a.anio != null && a.mes != null
            ? `${NOMBRES_MES[a.mes - 1] ?? a.mes} ${a.anio}`
            : 'Total',
        cantidadAsignada: a.cantidadAsignada,
        ejecutado: a.ejecutado,
        cumplimientoPorcentaje: a.cumplimientoPorcentaje,
      })),
      desviaciones: {
        metasConCuota: desviaciones.metasConCuota,
        fallosSinEjecucion: desviaciones.fallosSinEjecucion,
        incumplimientos: desviaciones.incumplimientos,
        detalle: desviaciones.detalle.map((d) => ({
          metaNombre: d.metaNombre,
          unidadMedida: d.unidadMedida,
          cantidadAsignada: d.cantidadAsignada,
          ejecutado: d.ejecutado,
          cumplimientoPorcentaje: d.cumplimientoPorcentaje,
          sinEjecucion: d.sinEjecucion,
          incumplida: d.incumplida,
        })),
      },
    });
  }

  private aplicarPeriodo(
    qb: ReturnType<Repository<Jornada>['createQueryBuilder']>,
    anio?: number | null,
    mes?: number | null,
  ): void {
    if (anio != null && mes != null) {
      const inicio = new Date(anio, mes - 1, 1);
      const fin = new Date(anio, mes, 0);
      qb.andWhere('jornada.fecha >= :inicioPeriodo', {
        inicioPeriodo: inicio,
      }).andWhere('jornada.fecha <= :finPeriodo', { finPeriodo: fin });
    }
  }
}
