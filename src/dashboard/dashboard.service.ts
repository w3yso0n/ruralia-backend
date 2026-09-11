import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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
import { generarPdfReporteDashboard } from './utils/generar-pdf-dashboard';

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
  ) {}

  async listarProyectosFiltro(): Promise<ProyectoFiltroDashboardDto[]> {
    const proyectos = await this.proyectoRepository.find({
      select: { id: true, nombre: true, tipo: true, estado: true },
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
    proyectoId?: string,
  ): Promise<DashboardCompletoDto> {
    const id = await this.resolverFiltro(proyectoId);
    const [
      kpis,
      medidores,
      actividadMensual,
      progresoProyectos,
      veredasCobertura,
      seguimientoDestacado,
      jornadasRecientes,
    ] = await Promise.all([
      this.obtenerResumen(id),
      this.obtenerCumplimiento(id),
      this.obtenerActividadMensual(meses, id),
      this.obtenerProgresoProyectos(id),
      this.obtenerMapaCobertura(id),
      this.obtenerSeguimientoDestacado(id),
      this.obtenerJornadasRecientes(5, id),
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

  async obtenerResumen(proyectoId?: string): Promise<ResumenDashboardDto> {
    const id = await this.resolverFiltro(proyectoId);

    const proyectosActivosWhere = id
      ? { id, estado: EstadoProyecto.ACTIVO }
      : { estado: EstadoProyecto.ACTIVO };

    const [
      proyectosActivos,
      totalProyectos,
      jornadasRegistradas,
      agentesRaw,
      recientes,
    ] = await Promise.all([
      this.proyectoRepository.count({ where: proyectosActivosWhere }),
      id
        ? this.proyectoRepository.count({ where: { id } })
        : this.proyectoRepository.count(),
      id
        ? this.jornadaRepository.count({ where: { proyecto: { id } } })
        : this.jornadaRepository.count(),
      this.qbJornadasNoCanceladas(id)
        .andWhere('jornada.tecnico_responsable_id IS NOT NULL')
        .select('COUNT(DISTINCT jornada.tecnico_responsable_id)', 'total')
        .getRawOne<{ total: string }>(),
      this.proyectoRepository.find({
        where: id ? { id } : { estado: EstadoProyecto.ACTIVO },
        order: { actualizadoEn: 'DESC' },
        take: id ? 1 : 5,
        relations: { proyectoBeneficiarios: true },
      }),
    ]);

    const agentesEnCampo = Number(agentesRaw?.total ?? 0);

    const proyectosRecientes = await Promise.all(
      recientes.map(async (p) => {
        const progreso = await this.actividadesService.obtenerProgreso(p.id);
        return {
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          estado: p.estado,
          progresoPorcentaje: progreso.progresoPorcentaje,
          conteoBeneficiarios: p.proyectoBeneficiarios?.length ?? 0,
          creadoEn: p.creadoEn,
          actualizadoEn: p.actualizadoEn,
        };
      }),
    );

    return {
      proyectosActivos,
      totalProyectos,
      jornadasRegistradas,
      agentesEnCampo,
      proyectosRecientes,
    };
  }

  async obtenerCumplimiento(
    proyectoId?: string,
  ): Promise<CumplimientoDashboardDto> {
    const id = await this.resolverFiltro(proyectoId);

    const activos = id
      ? await this.proyectoRepository.find({
          where: { id },
          select: { id: true },
        })
      : await this.proyectoRepository.find({
          where: { estado: EstadoProyecto.ACTIVO },
          select: { id: true },
        });

    let cumplimientoPlan = 0;
    if (activos.length > 0) {
      const progresos = await Promise.all(
        activos.map((p) => this.actividadesService.obtenerProgreso(p.id)),
      );
      const suma = progresos.reduce((acc, p) => acc + p.progresoPorcentaje, 0);
      cumplimientoPlan = Math.round(suma / progresos.length);
    }

    const idsActivos = activos.map((p) => p.id);

    let coberturaTerritorial = 0;
    if (idsActivos.length > 0) {
      const totalVeredas = await this.proyectoRepository
        .createQueryBuilder('proyecto')
        .innerJoin('proyecto.veredas', 'vereda')
        .where('proyecto.id IN (:...ids)', { ids: idsActivos })
        .select('COUNT(DISTINCT vereda.id)', 'total')
        .getRawOne<{ total: string }>();

      const veredasConJornada = this.qbJornadasNoCanceladas()
        .andWhere('jornada.proyecto_id IN (:...ids)', { ids: idsActivos })
        .andWhere('jornada.vereda_id IS NOT NULL')
        .select('COUNT(DISTINCT jornada.vereda_id)', 'total');

      const rawVeredas = await veredasConJornada.getRawOne<{ total: string }>();

      const denom = Number(totalVeredas?.total ?? 0);
      const numer = Number(rawVeredas?.total ?? 0);
      coberturaTerritorial = denom > 0 ? Math.round((numer / denom) * 100) : 0;
    }

    const completadasQb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.estado = :estado', {
        estado: EstadoJornada.COMPLETADA,
      });
    this.aplicarProyecto(completadasQb, id);
    const completadas = await completadasQb.getCount();

    let jornadasConEvidencia = 0;
    if (completadas > 0) {
      const conFotoQb = this.evidenciaRepository
        .createQueryBuilder('evidencia')
        .innerJoin('evidencia.jornada', 'jornada')
        .where('jornada.estado = :estado', {
          estado: EstadoJornada.COMPLETADA,
        })
        .andWhere('evidencia.tipo = :tipo', { tipo: TipoEvidencia.FOTO })
        .select('COUNT(DISTINCT jornada.id)', 'total');
      this.aplicarProyecto(conFotoQb, id);
      const conFoto = await conFotoQb.getRawOne<{ total: string }>();

      jornadasConEvidencia = Math.round(
        (Number(conFoto?.total ?? 0) / completadas) * 100,
      );
    }

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

    const jornadasMesQb = this.qbJornadasNoCanceladas(id)
      .andWhere('jornada.fecha >= :inicio', { inicio: inicioMes })
      .andWhere('jornada.fecha <= :fin', { fin: finMes });
    const jornadasMesActual = await jornadasMesQb.getCount();

    return {
      cumplimientoPlan,
      coberturaTerritorial,
      jornadasConEvidencia,
      jornadasMesActual,
    };
  }

  async obtenerActividadMensual(
    meses = 6,
    proyectoId?: string,
  ): Promise<SerieMensualDashboardDto[]> {
    const id = await this.resolverFiltro(proyectoId);
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
    this.aplicarProyecto(jornadasPorMesQb, id);
    const jornadasPorMes = await jornadasPorMesQb.getRawMany<{
      anio: string;
      mes: string;
      total: string;
    }>();

    const formulariosPorMesQb = this.envioRepository
      .createQueryBuilder('envio')
      .select(`EXTRACT(YEAR FROM envio.enviado_en)`, 'anio')
      .addSelect(`EXTRACT(MONTH FROM envio.enviado_en)`, 'mes')
      .addSelect('COUNT(*)', 'total')
      .where('envio.enviado_en >= :inicio', { inicio })
      .groupBy('anio')
      .addGroupBy('mes');
    if (id) {
      formulariosPorMesQb
        .innerJoin('envio.jornada', 'jornada')
        .andWhere('jornada.proyecto_id = :proyectoId', { proyectoId: id });
    }
    const formulariosPorMes = await formulariosPorMesQb.getRawMany<{
      anio: string;
      mes: string;
      total: string;
    }>();

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
    this.aplicarProyecto(beneficiariosPorMesQb, id);
    const beneficiariosPorMes = await beneficiariosPorMesQb.getRawMany<{
      anio: string;
      mes: string;
      total: string;
    }>();

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
    proyectoId?: string,
  ): Promise<ProgresoProyectoDashboardDto[]> {
    const id = await this.resolverFiltro(proyectoId);
    const activos = await this.proyectoRepository.find({
      where: id ? { id } : { estado: EstadoProyecto.ACTIVO },
      order: { actualizadoEn: 'DESC' },
      take: id ? 1 : 12,
      relations: { proyectoBeneficiarios: true },
    });

    return Promise.all(
      activos.map(async (p) => {
        const progreso = await this.actividadesService.obtenerProgreso(p.id);
        return {
          proyectoId: p.id,
          nombre: p.nombre.includes(' — ')
            ? (p.nombre.split(' — ')[0] ?? p.nombre)
            : p.nombre,
          tipo: p.tipo,
          progresoPorcentaje: progreso.progresoPorcentaje,
          conteoBeneficiarios: p.proyectoBeneficiarios?.length ?? 0,
        };
      }),
    );
  }

  async obtenerMapaCobertura(
    proyectoId?: string,
  ): Promise<VeredaCoberturaDto[]> {
    const id = await this.resolverFiltro(proyectoId);
    const proyectos = await this.proyectoRepository.find({
      where: id
        ? { id }
        : [
            { estado: EstadoProyecto.ACTIVO },
            { estado: EstadoProyecto.SUSPENDIDO },
          ],
      relations: {
        veredas: { municipio: { departamento: true } },
        proyectoBeneficiarios: true,
      },
    });

    const progresoPorProyecto = new Map<string, number>();
    await Promise.all(
      proyectos.map(async (p) => {
        const pr = await this.actividadesService.obtenerProgreso(p.id);
        progresoPorProyecto.set(p.id, pr.progresoPorcentaje);
      }),
    );

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
          beneficiarios: p.proyectoBeneficiarios?.length ?? 0,
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
    this.aplicarProyecto(centroidesQb, id);
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
    proyectoId?: string,
  ): Promise<SeguimientoCampoDashboardDto | null> {
    const id = await this.resolverFiltro(proyectoId);

    let proyectoIdDestacado = id;
    let nombreProyecto: string | undefined;

    if (proyectoIdDestacado) {
      const proyecto = await this.proyectoRepository.findOne({
        where: { id: proyectoIdDestacado },
        select: { id: true, nombre: true },
      });
      nombreProyecto = proyecto?.nombre;
    } else {
      const candidatos = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .innerJoin('jornada.proyecto', 'proyecto')
        .where('proyecto.estado = :estado', { estado: EstadoProyecto.ACTIVO })
        .andWhere('jornada.latitud IS NOT NULL')
        .andWhere('jornada.longitud IS NOT NULL')
        .andWhere('jornada.estado != :cancelada', {
          cancelada: EstadoJornada.CANCELADA,
        })
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
    proyectoId?: string,
  ): Promise<JornadaRecienteDashboardDto[]> {
    const id = await this.resolverFiltro(proyectoId);
    const jornadas = await this.jornadaRepository.find({
      where: id ? { proyecto: { id } } : {},
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
  ): Promise<Buffer> {
    const id = await this.resolverFiltro(proyectoId);
    const [completo, agentes] = await Promise.all([
      this.obtenerCompleto(6, id),
      this.obtenerAgentesParaPdf(id),
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

  private async obtenerAgentesParaPdf(proyectoId?: string) {
    try {
      if (proyectoId) {
        const ranking = await this.evaluacionesService.productividadProyecto(
          proyectoId,
          {},
        );
        return ranking.slice(0, 8);
      }
      return await this.evaluacionesService.cumplimientoEquipoGlobal(
        undefined,
        undefined,
        8,
      );
    } catch {
      return [];
    }
  }

  private async resolverFiltro(
    proyectoId?: string,
  ): Promise<string | undefined> {
    if (!proyectoId) return undefined;
    const existe = await this.proyectoRepository.exists({
      where: { id: proyectoId },
    });
    if (!existe) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }
    return proyectoId;
  }

  private qbJornadasNoCanceladas(
    proyectoId?: string,
  ): SelectQueryBuilder<Jornada> {
    const qb = this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      });
    this.aplicarProyecto(qb, proyectoId);
    return qb;
  }

  private aplicarProyecto<T extends { id?: string }>(
    qb: SelectQueryBuilder<T>,
    proyectoId?: string,
    alias = 'jornada',
  ) {
    if (proyectoId) {
      qb.andWhere(`${alias}.proyecto_id = :proyectoId`, { proyectoId });
    }
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
