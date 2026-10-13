import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { ActividadesService } from '../actividades/actividades.service';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { TipoEvidencia } from '../evidencias/enums/tipo-evidencia.enum';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { EstadoJornada } from '../jornadas/enums/estado-jornada.enum';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { EstadoProyecto } from '../proyectos/enums/estado-proyecto.enum';
import {
  CumplimientoDashboardDto,
  DashboardCompletoDto,
  JornadaGeorefDashboardDto,
  JornadaRecienteDashboardDto,
  ProgresoProyectoDashboardDto,
  ProyectoFiltroDashboardDto,
  ResumenDashboardDto,
  SeguimientoCampoDashboardDto,
  SerieMensualDashboardDto,
  VeredaCoberturaDto,
} from './dto/respuesta-dashboard.dto';
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { generarPdfReporteDashboard } from './utils/generar-pdf-dashboard';

type AlcanceConsulta = {
  filtro?: string;
  permitidos: string[] | null;
};

const MESES_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
    private readonly actividadesService: ActividadesService,
    private readonly evaluacionesService: EvaluacionesService,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

  async listarProyectosFiltro(
    usuario: Usuario,
  ): Promise<ProyectoFiltroDashboardDto[]> {
    const alcance = await this.comoAlcance(undefined, usuario);
    if (alcance.permitidos && alcance.permitidos.length === 0) return [];
    const proyectos = await this.proyectoRepository.find({
      select: { id: true, nombre: true, tipo: true, estado: true },
      where: alcance.permitidos ? { id: In(alcance.permitidos) } : undefined,
      order: { nombre: 'ASC' },
    });
    return proyectos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      estado: p.estado,
    }));
  }

  async obtenerCompleto(
    meses = 6,
    proyectoId?: string | AlcanceConsulta,
    usuario?: Usuario,
  ): Promise<DashboardCompletoDto> {
    const alcance = await this.comoAlcance(proyectoId, usuario);
    const [
      kpis,
      medidores,
      actividadMensual,
      progresoProyectos,
      veredasCobertura,
      seguimientoDestacado,
      jornadasRecientes,
    ] = await Promise.all([
      this.obtenerResumen(alcance),
      this.obtenerCumplimiento(alcance),
      this.obtenerActividadMensual(meses, alcance),
      this.obtenerProgresoProyectos(alcance),
      this.obtenerMapaCobertura(alcance),
      this.obtenerSeguimientoDestacado(alcance),
      this.obtenerJornadasRecientes(5, alcance),
    ]);

    return {
      kpis,
      medidores,
      actividadMensual,
      progresoProyectos,
      veredasCobertura,
      seguimientoDestacado,
      jornadasRecientes,
    };
  }

  async obtenerResumen(
    proyectoId?: string | AlcanceConsulta,
    usuario?: Usuario,
  ): Promise<ResumenDashboardDto> {
    const alcance = await this.comoAlcance(proyectoId, usuario);
    const id = alcance.filtro;
    const whereTodos = this.whereProyecto(alcance);
    const whereActivos = this.whereProyecto(alcance, {
      estado: EstadoProyecto.ACTIVO,
    });

    const [
      proyectosActivos,
      totalProyectos,
      jornadasRegistradas,
      agentesRaw,
      recientes,
    ] = await Promise.all([
      whereActivos
        ? this.proyectoRepository.count({ where: whereActivos })
        : Promise.resolve(0),
      whereTodos
        ? this.proyectoRepository.count({ where: whereTodos })
        : Promise.resolve(0),
      this.contarJornadas(alcance),
      this.qbJornadasNoCanceladas(alcance)
        .andWhere('jornada.tecnico_responsable_id IS NOT NULL')
        .select('COUNT(DISTINCT jornada.tecnico_responsable_id)', 'total')
        .getRawOne<{ total: string }>(),
      whereActivos || id
        ? this.proyectoRepository.find({
            where: id
              ? { id }
              : (whereActivos ?? { estado: EstadoProyecto.ACTIVO }),
            order: { actualizadoEn: 'DESC' },
            take: id ? 1 : 5,
          })
        : Promise.resolve([]),
    ]);

    const agentesEnCampo = Number(agentesRaw?.total ?? 0);

    const idsRecientes = recientes.map((p) => p.id);
    const [progresos, beneficiarios] = await Promise.all([
      this.actividadesService.obtenerProgresoPorProyectos(idsRecientes),
      this.contarBeneficiariosPorProyecto(idsRecientes),
    ]);
    const proyectosRecientes = recientes.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      estado: p.estado,
      progresoPorcentaje: progresos.get(p.id) ?? 0,
      conteoBeneficiarios: beneficiarios.get(p.id) ?? 0,
      creadoEn: p.creadoEn,
      actualizadoEn: p.actualizadoEn,
    }));

    return {
      proyectosActivos,
      totalProyectos,
      jornadasRegistradas,
      agentesEnCampo,
      proyectosRecientes,
    };
  }

  async obtenerCumplimiento(
    proyectoId?: string | AlcanceConsulta,
    usuario?: Usuario,
  ): Promise<CumplimientoDashboardDto> {
    const alcance = await this.comoAlcance(proyectoId, usuario);
    const id = alcance.filtro;
    const whereActivos = this.whereProyecto(alcance, {
      estado: EstadoProyecto.ACTIVO,
    });

    const activos = whereActivos
      ? await this.proyectoRepository.find({
          where: id ? { id } : whereActivos,
          select: { id: true },
        })
      : [];
    const idsActivos = activos.map((p) => p.id);

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

    const completadasQb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.estado = :estado', {
        estado: EstadoJornada.COMPLETADA,
      });
    this.aplicarProyecto(completadasQb, alcance);

    const conFotoQb = this.evidenciaRepository
      .createQueryBuilder('evidencia')
      .innerJoin('evidencia.jornada', 'jornada')
      .where('jornada.estado = :estado', {
        estado: EstadoJornada.COMPLETADA,
      })
      .andWhere('evidencia.tipo = :tipo', { tipo: TipoEvidencia.FOTO })
      .select('COUNT(DISTINCT jornada.id)', 'total');
    this.aplicarProyecto(conFotoQb, alcance);

    const jornadasMesQb = this.qbJornadasNoCanceladas(alcance)
      .andWhere('jornada.fecha >= :inicio', { inicio: inicioMes })
      .andWhere('jornada.fecha <= :fin', { fin: finMes });

    const [
      progresos,
      totalVeredas,
      veredasConJornada,
      completadas,
      conFoto,
      jornadasMesActual,
    ] = await Promise.all([
      this.actividadesService.obtenerProgresoPorProyectos(idsActivos),
      idsActivos.length
        ? this.proyectoRepository
            .createQueryBuilder('proyecto')
            .innerJoin('proyecto.veredas', 'vereda')
            .where('proyecto.id IN (:...ids)', { ids: idsActivos })
            .select('COUNT(DISTINCT vereda.id)', 'total')
            .getRawOne<{ total: string }>()
        : Promise.resolve(undefined),
      idsActivos.length
        ? this.qbJornadasNoCanceladas(alcance)
            .andWhere('jornada.proyecto_id IN (:...ids)', { ids: idsActivos })
            .andWhere('jornada.vereda_id IS NOT NULL')
            .select('COUNT(DISTINCT jornada.vereda_id)', 'total')
            .getRawOne<{ total: string }>()
        : Promise.resolve(undefined),
      completadasQb.getCount(),
      conFotoQb.getRawOne<{ total: string }>(),
      jornadasMesQb.getCount(),
    ]);

    let cumplimientoPlan = 0;
    if (idsActivos.length > 0) {
      const suma = idsActivos.reduce(
        (acc, pid) => acc + (progresos.get(pid) ?? 0),
        0,
      );
      cumplimientoPlan = Math.round(suma / idsActivos.length);
    }

    const denom = Number(totalVeredas?.total ?? 0);
    const numer = Number(veredasConJornada?.total ?? 0);
    const coberturaTerritorial =
      denom > 0 ? Math.round((numer / denom) * 100) : 0;

    const jornadasConEvidencia =
      completadas > 0
        ? Math.round((Number(conFoto?.total ?? 0) / completadas) * 100)
        : 0;

    return {
      cumplimientoPlan,
      coberturaTerritorial,
      jornadasConEvidencia,
      jornadasMesActual,
    };
  }

  async obtenerActividadMensual(
    meses = 6,
    proyectoId?: string | AlcanceConsulta,
    usuario?: Usuario,
  ): Promise<SerieMensualDashboardDto[]> {
    const alcance = await this.comoAlcance(proyectoId, usuario);
    const id = alcance.filtro;
    const ahora = new Date();
    const inicio = new Date(
      ahora.getFullYear(),
      ahora.getMonth() - (meses - 1),
      1,
    );

    const jornadasPorMesQb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .select(`EXTRACT(YEAR FROM jornada.fecha)`, 'anio')
      .addSelect(`EXTRACT(MONTH FROM jornada.fecha)`, 'mes')
      .addSelect('COUNT(*)', 'total')
      .where('jornada.fecha >= :inicio', { inicio })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .groupBy('anio')
      .addGroupBy('mes');
    this.aplicarProyecto(jornadasPorMesQb, alcance);

    const formulariosPorMesQb = this.envioRepository
      .createQueryBuilder('envio')
      .select(`EXTRACT(YEAR FROM envio.enviado_en)`, 'anio')
      .addSelect(`EXTRACT(MONTH FROM envio.enviado_en)`, 'mes')
      .addSelect('COUNT(*)', 'total')
      .where('envio.enviado_en >= :inicio', { inicio })
      .groupBy('anio')
      .addGroupBy('mes');
    if (id || alcance.permitidos) {
      formulariosPorMesQb.innerJoin('envio.jornada', 'jornada');
      this.aplicarProyecto(formulariosPorMesQb, alcance);
    }

    const beneficiariosPorMesQb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .innerJoin('jornada.beneficiarios', 'beneficiario')
      .select(`EXTRACT(YEAR FROM jornada.fecha)`, 'anio')
      .addSelect(`EXTRACT(MONTH FROM jornada.fecha)`, 'mes')
      .addSelect('COUNT(DISTINCT beneficiario.id)', 'total')
      .where('jornada.fecha >= :inicio', { inicio })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .groupBy('anio')
      .addGroupBy('mes');
    this.aplicarProyecto(beneficiariosPorMesQb, alcance);

    type FilaMes = { anio: string; mes: string; total: string };
    const [jornadasPorMes, formulariosPorMes, beneficiariosPorMes] =
      await Promise.all([
        jornadasPorMesQb.getRawMany<FilaMes>(),
        formulariosPorMesQb.getRawMany<FilaMes>(),
        beneficiariosPorMesQb.getRawMany<FilaMes>(),
      ]);

    const mapaJ = this.aMapaMes(jornadasPorMes);
    const mapaF = this.aMapaMes(formulariosPorMes);
    const mapaB = this.aMapaMes(beneficiariosPorMes);

    const serie: SerieMensualDashboardDto[] = [];
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const clave = `${d.getFullYear()}-${d.getMonth() + 1}`;
      serie.push({
        mes: MESES_ES[d.getMonth()],
        jornadas: mapaJ.get(clave) ?? 0,
        formularios: mapaF.get(clave) ?? 0,
        beneficiariosAtendidos: mapaB.get(clave) ?? 0,
      });
    }
    return serie;
  }

  async obtenerProgresoProyectos(
    proyectoId?: string | AlcanceConsulta,
    usuario?: Usuario,
  ): Promise<ProgresoProyectoDashboardDto[]> {
    const alcance = await this.comoAlcance(proyectoId, usuario);
    const id = alcance.filtro;
    const whereActivos = this.whereProyecto(alcance, {
      estado: EstadoProyecto.ACTIVO,
    });
    if (!id && !whereActivos) return [];
    const activos = await this.proyectoRepository.find({
      where: id ? { id } : whereActivos!,
      order: { actualizadoEn: 'DESC' },
      take: id ? 1 : 12,
    });

    const ids = activos.map((p) => p.id);
    const [progresos, beneficiarios] = await Promise.all([
      this.actividadesService.obtenerProgresoPorProyectos(ids),
      this.contarBeneficiariosPorProyecto(ids),
    ]);
    return activos.map((p) => ({
      proyectoId: p.id,
      nombre: p.nombre.includes(' — ')
        ? (p.nombre.split(' — ')[0] ?? p.nombre)
        : p.nombre,
      tipo: p.tipo,
      progresoPorcentaje: progresos.get(p.id) ?? 0,
      conteoBeneficiarios: beneficiarios.get(p.id) ?? 0,
    }));
  }

  async obtenerMapaCobertura(
    proyectoId?: string | AlcanceConsulta,
    usuario?: Usuario,
  ): Promise<VeredaCoberturaDto[]> {
    const alcance = await this.comoAlcance(proyectoId, usuario);
    const id = alcance.filtro;
    const whereTodos = this.whereProyecto(alcance);
    if (!id && whereTodos === null) return [];
    const proyectos = await this.proyectoRepository.find({
      where: id
        ? { id }
        : alcance.permitidos
          ? [
              { id: In(alcance.permitidos), estado: EstadoProyecto.ACTIVO },
              { id: In(alcance.permitidos), estado: EstadoProyecto.SUSPENDIDO },
            ]
          : [
              { estado: EstadoProyecto.ACTIVO },
              { estado: EstadoProyecto.SUSPENDIDO },
            ],
      relations: {
        veredas: { municipio: { departamento: true } },
      },
    });

    const ids = proyectos.map((p) => p.id);
    const [progresoPorProyecto, beneficiariosPorProyecto] = await Promise.all([
      this.actividadesService.obtenerProgresoPorProyectos(ids),
      this.contarBeneficiariosPorProyecto(ids),
    ]);

    type Acum = {
      veredaId: string;
      nombre: string;
      municipio: string;
      departamento: string;
      proyectos: VeredaCoberturaDto['proyectos'];
    };

    const porVereda = new Map<string, Acum>();

    for (const p of proyectos) {
      for (const v of p.veredas ?? []) {
        let acum = porVereda.get(v.id);
        if (!acum) {
          acum = {
            veredaId: v.id,
            nombre: v.nombre,
            municipio: v.municipio?.nombre ?? '',
            departamento: v.municipio?.departamento?.nombre ?? '',
            proyectos: [],
          };
          porVereda.set(v.id, acum);
        }
        acum.proyectos.push({
          proyectoId: p.id,
          nombre: p.nombre,
          estado: p.estado,
          progresoPorcentaje: progresoPorProyecto.get(p.id) ?? 0,
          beneficiarios: beneficiariosPorProyecto.get(p.id) ?? 0,
        });
      }
    }

    if (porVereda.size === 0) return [];

    const centroidesQb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .select('jornada.vereda_id', 'veredaId')
      .addSelect('AVG(jornada.latitud)', 'latitud')
      .addSelect('AVG(jornada.longitud)', 'longitud')
      .where('jornada.vereda_id IN (:...ids)', {
        ids: [...porVereda.keys()],
      })
      .andWhere('jornada.latitud IS NOT NULL')
      .andWhere('jornada.longitud IS NOT NULL')
      .groupBy('jornada.vereda_id');
    this.aplicarProyecto(centroidesQb, alcance);
    const centroides = await centroidesQb.getRawMany<{
      veredaId: string;
      latitud: string;
      longitud: string;
    }>();

    const mapaCentroide = new Map(
      centroides.map((c) => [
        c.veredaId,
        { latitud: Number(c.latitud), longitud: Number(c.longitud) },
      ]),
    );

    const resultado: VeredaCoberturaDto[] = [];
    for (const acum of porVereda.values()) {
      const centro = mapaCentroide.get(acum.veredaId);
      const veredaEntidad = proyectos
        .flatMap((p) => p.veredas ?? [])
        .find((v) => v.id === acum.veredaId);

      const latitud =
        centro?.latitud ??
        (veredaEntidad?.latitud != null ? Number(veredaEntidad.latitud) : null);
      const longitud =
        centro?.longitud ??
        (veredaEntidad?.longitud != null
          ? Number(veredaEntidad.longitud)
          : null);

      if (latitud == null || longitud == null) continue;

      resultado.push({
        ...acum,
        latitud,
        longitud,
      });
    }

    return resultado;
  }

  async obtenerSeguimientoDestacado(
    proyectoId?: string | AlcanceConsulta,
    usuario?: Usuario,
  ): Promise<SeguimientoCampoDashboardDto | null> {
    const alcance = await this.comoAlcance(proyectoId, usuario);
    const id = alcance.filtro;

    let proyectoIdDestacado = id;
    let nombreProyecto: string | undefined;

    if (proyectoIdDestacado) {
      const proyecto = await this.proyectoRepository.findOne({
        where: { id: proyectoIdDestacado },
        select: { id: true, nombre: true },
      });
      nombreProyecto = proyecto?.nombre;
    } else {
      const candidatosQb = this.jornadaRepository
        .createQueryBuilder('jornada')
        .innerJoin('jornada.proyecto', 'proyecto')
        .where('proyecto.estado = :estado', { estado: EstadoProyecto.ACTIVO })
        .andWhere('jornada.latitud IS NOT NULL')
        .andWhere('jornada.longitud IS NOT NULL')
        .andWhere('jornada.estado != :cancelada', {
          cancelada: EstadoJornada.CANCELADA,
        });
      this.aplicarProyecto(candidatosQb, alcance);
      const candidatos = await candidatosQb
        .select('proyecto.id', 'proyectoId')
        .addSelect('proyecto.nombre', 'nombreProyecto')
        .addSelect('COUNT(*)', 'total')
        .groupBy('proyecto.id')
        .addGroupBy('proyecto.nombre')
        .orderBy('total', 'DESC')
        .limit(1)
        .getRawOne<{
          proyectoId: string;
          nombreProyecto: string;
          total: string;
        }>();

      if (!candidatos) return null;
      proyectoIdDestacado = candidatos.proyectoId;
      nombreProyecto = candidatos.nombreProyecto;
    }

    if (!proyectoIdDestacado) return null;

    const jornadas = await this.jornadaRepository.find({
      where: {
        proyecto: { id: proyectoIdDestacado },
      },
      order: { fecha: 'ASC' },
      take: 60,
    });

    const conGeo = jornadas.filter(
      (j) =>
        j.latitud != null &&
        j.longitud != null &&
        j.estado !== EstadoJornada.CANCELADA,
    );
    const completadas = conGeo.filter(
      (j) => j.estado === EstadoJornada.COMPLETADA,
    ).length;

    const puntos: JornadaGeorefDashboardDto[] = conGeo.map((j) => ({
      jornadaId: j.id,
      nombre: j.nombre || 'Jornada',
      latitud: Number(j.latitud),
      longitud: Number(j.longitud),
      estado: j.estado,
      fecha: j.fecha ? new Date(j.fecha).toISOString().slice(0, 10) : undefined,
      descripcion: j.observaciones || j.nombre || '',
    }));

    return {
      proyectoId: proyectoIdDestacado,
      nombreProyecto: nombreProyecto ?? '',
      jornadas: puntos,
      progresoAvancePorcentaje:
        conGeo.length > 0 ? Math.round((completadas / conGeo.length) * 100) : 0,
    };
  }

  async obtenerJornadasRecientes(
    limite = 5,
    proyectoId?: string | AlcanceConsulta,
    usuario?: Usuario,
  ): Promise<JornadaRecienteDashboardDto[]> {
    const alcance = await this.comoAlcance(proyectoId, usuario);
    const id = alcance.filtro;
    const whereTodos = this.whereProyecto(alcance);
    if (!id && whereTodos === null) return [];
    const jornadas = await this.jornadaRepository.find({
      where: id
        ? { proyecto: { id } }
        : alcance.permitidos
          ? { proyecto: { id: In(alcance.permitidos) } }
          : {},
      relations: {
        proyecto: true,
        vereda: true,
        tecnicoResponsable: true,
      },
      order: { fecha: 'DESC' },
      take: limite,
    });

    return jornadas
      .filter((j) => j.estado !== EstadoJornada.CANCELADA)
      .map((j) => ({
        id: j.id,
        proyectoNombre: j.proyecto?.nombre ?? '',
        veredaNombre: j.vereda?.nombre ?? '—',
        tecnico:
          j.tecnicoResponsableNombre ||
          j.tecnicoResponsable?.nombreCompleto ||
          '—',
        estado: j.estado,
        fecha: j.fecha ? new Date(j.fecha).toISOString().slice(0, 10) : '',
      }));
  }

  async generarPdf(
    proyectoId?: string,
    generadoPor?: string,
    usuario?: Usuario,
  ): Promise<Buffer> {
    const alcance = await this.comoAlcance(proyectoId, usuario);
    const id = alcance.filtro;
    const [completo, agentes] = await Promise.all([
      this.obtenerCompleto(6, alcance, usuario),
      this.obtenerAgentesParaPdf(alcance),
    ]);

    let proyectoNombre: string | null = null;
    let proyectoEstado: string | null = null;
    if (id) {
      const proyecto = await this.proyectoRepository.findOne({
        where: { id },
        select: { nombre: true, estado: true },
      });
      proyectoNombre = proyecto?.nombre ?? null;
      proyectoEstado = proyecto?.estado ?? null;
    }

    return generarPdfReporteDashboard({
      generadoEn: new Date(),
      generadoPor,
      proyectoNombre,
      proyectoEstado,
      kpis: completo.kpis,
      medidores: completo.medidores,
      actividadMensual: completo.actividadMensual,
      progresoProyectos: completo.progresoProyectos,
      veredasCobertura: completo.veredasCobertura,
      jornadasRecientes: completo.jornadasRecientes,
      agentes: agentes.map((a, i) => ({
        puesto: i + 1,
        nombreCompleto: a.nombreCompleto,
        indiceEficiencia: a.indiceEficiencia,
        cumplimientoPorcentaje: a.cumplimientoPorcentaje,
        conteoJornadas: a.conteoJornadas,
        proyectoNombre: id ? null : a.proyectoNombre,
      })),
    });
  }

  private async obtenerAgentesParaPdf(alcance: AlcanceConsulta) {
    try {
      if (alcance.filtro) {
        const ranking = await this.evaluacionesService.productividadProyecto(
          alcance.filtro,
          {},
        );
        return ranking.slice(0, 8);
      }
      return await this.evaluacionesService.cumplimientoEquipoGlobal(
        undefined,
        undefined,
        8,
        alcance.permitidos,
      );
    } catch {
      return [];
    }
  }

  private async resolverFiltro(
    proyectoId: string | undefined,
    usuario?: Usuario,
  ): Promise<AlcanceConsulta> {
    const [permitidos, existe] = await Promise.all([
      usuario
        ? this.alcanceTerritorialService.idsProyectosVisibles(usuario)
        : Promise.resolve(null),
      proyectoId
        ? this.proyectoRepository.exists({ where: { id: proyectoId } })
        : Promise.resolve(true),
    ]);
    if (!proyectoId) return { permitidos };
    if (!existe) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }
    if (permitidos && !permitidos.includes(proyectoId)) {
      throw new ForbiddenException('No tiene acceso a este proyecto');
    }
    return { filtro: proyectoId, permitidos };
  }

  private async comoAlcance(
    valor?: string | AlcanceConsulta,
    usuario?: Usuario,
  ): Promise<AlcanceConsulta> {
    if (valor && typeof valor === 'object' && 'permitidos' in valor) {
      return valor;
    }
    return this.resolverFiltro(
      typeof valor === 'string' ? valor : undefined,
      usuario,
    );
  }

  /** Vínculos de beneficiarios por proyecto con un GROUP BY, sin cargarlos. */
  private async contarBeneficiariosPorProyecto(
    ids: string[],
  ): Promise<Map<string, number>> {
    const mapa = new Map<string, number>();
    if (!ids.length) return mapa;
    const filas = await this.proyectoRepository.manager
      .createQueryBuilder()
      .select('pb.proyecto_id', 'proyectoId')
      .addSelect('COUNT(*)', 'total')
      .from('proyecto_beneficiarios', 'pb')
      .where('pb.proyecto_id IN (:...ids)', { ids })
      .groupBy('pb.proyecto_id')
      .getRawMany<{ proyectoId: string; total: string }>();
    for (const fila of filas) mapa.set(fila.proyectoId, Number(fila.total));
    return mapa;
  }

  private async contarJornadas(alcance: AlcanceConsulta): Promise<number> {
    if (alcance.filtro) {
      return this.jornadaRepository.count({
        where: { proyecto: { id: alcance.filtro } },
      });
    }
    if (alcance.permitidos === null) return this.jornadaRepository.count();
    if (!alcance.permitidos.length) return 0;
    return this.jornadaRepository.count({
      where: { proyecto: { id: In(alcance.permitidos) } },
    });
  }

  private whereProyecto(
    alcance: AlcanceConsulta,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> | null {
    if (alcance.filtro) return { ...extra, id: alcance.filtro };
    if (alcance.permitidos === null) return extra;
    if (!alcance.permitidos.length) return null;
    return { ...extra, id: In(alcance.permitidos) };
  }

  private qbJornadasNoCanceladas(
    alcance?: AlcanceConsulta,
  ): SelectQueryBuilder<Jornada> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      });
    if (alcance) this.aplicarProyecto(qb, alcance);
    return qb;
  }

  private aplicarProyecto<T extends { id?: string }>(
    qb: SelectQueryBuilder<T>,
    alcance: AlcanceConsulta,
    alias = 'jornada',
  ) {
    if (alcance.filtro) {
      qb.andWhere(`${alias}.proyecto_id = :proyectoId`, {
        proyectoId: alcance.filtro,
      });
      return;
    }
    if (alcance.permitidos === null) return;
    if (!alcance.permitidos.length) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere(`${alias}.proyecto_id IN (:...permitidos)`, {
      permitidos: alcance.permitidos,
    });
  }

  private aMapaMes(
    filas: Array<{ anio: string; mes: string; total: string }>,
  ): Map<string, number> {
    const mapa = new Map<string, number>();
    for (const f of filas) {
      const clave = `${Number(f.anio)}-${Number(f.mes)}`;
      mapa.set(clave, Number(f.total));
    }
    return mapa;
  }
}
