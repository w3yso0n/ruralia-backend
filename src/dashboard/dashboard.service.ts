import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActividadesService } from '../actividades/actividades.service';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { TipoEvidencia } from '../evidencias/enums/tipo-evidencia.enum';
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
  ResumenDashboardDto,
  SeguimientoCampoDashboardDto,
  SerieMensualDashboardDto,
  VeredaCoberturaDto,
} from './dto/respuesta-dashboard.dto';

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
  ) {}

  async obtenerCompleto(meses = 6): Promise<DashboardCompletoDto> {
    const [
      kpis,
      medidores,
      actividadMensual,
      progresoProyectos,
      veredasCobertura,
      seguimientoDestacado,
      jornadasRecientes,
    ] = await Promise.all([
      this.obtenerResumen(),
      this.obtenerCumplimiento(),
      this.obtenerActividadMensual(meses),
      this.obtenerProgresoProyectos(),
      this.obtenerMapaCobertura(),
      this.obtenerSeguimientoDestacado(),
      this.obtenerJornadasRecientes(5),
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

  async obtenerResumen(): Promise<ResumenDashboardDto> {
    const [proyectosActivos, totalProyectos, jornadasRegistradas, agentesRaw, recientes] =
      await Promise.all([
        this.proyectoRepository.count({
          where: { estado: EstadoProyecto.ACTIVO },
        }),
        this.proyectoRepository.count(),
        this.jornadaRepository.count(),
        this.jornadaRepository
          .createQueryBuilder('jornada')
          .where('jornada.estado != :cancelada', {
            cancelada: EstadoJornada.CANCELADA,
          })
          .andWhere('jornada.tecnico_responsable_id IS NOT NULL')
          .select('COUNT(DISTINCT jornada.tecnico_responsable_id)', 'total')
          .getRawOne<{ total: string }>(),
        this.proyectoRepository.find({
          where: { estado: EstadoProyecto.ACTIVO },
          order: { actualizadoEn: 'DESC' },
          take: 5,
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

  async obtenerCumplimiento(): Promise<CumplimientoDashboardDto> {
    const activos = await this.proyectoRepository.find({
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

      const veredasConJornada = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .where('jornada.proyecto_id IN (:...ids)', { ids: idsActivos })
        .andWhere('jornada.vereda_id IS NOT NULL')
        .andWhere('jornada.estado != :cancelada', {
          cancelada: EstadoJornada.CANCELADA,
        })
        .select('COUNT(DISTINCT jornada.vereda_id)', 'total')
        .getRawOne<{ total: string }>();

      const denom = Number(totalVeredas?.total ?? 0);
      const numer = Number(veredasConJornada?.total ?? 0);
      coberturaTerritorial =
        denom > 0 ? Math.round((numer / denom) * 100) : 0;
    }

    const completadas = await this.jornadaRepository.count({
      where: { estado: EstadoJornada.COMPLETADA },
    });

    let jornadasConEvidencia = 0;
    if (completadas > 0) {
      const conFoto = await this.evidenciaRepository
        .createQueryBuilder('evidencia')
        .innerJoin('evidencia.jornada', 'jornada')
        .where('jornada.estado = :estado', {
          estado: EstadoJornada.COMPLETADA,
        })
        .andWhere('evidencia.tipo = :tipo', { tipo: TipoEvidencia.FOTO })
        .select('COUNT(DISTINCT jornada.id)', 'total')
        .getRawOne<{ total: string }>();

      jornadasConEvidencia = Math.round(
        (Number(conFoto?.total ?? 0) / completadas) * 100,
      );
    }

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

    const jornadasMesActual = await this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.fecha >= :inicio', { inicio: inicioMes })
      .andWhere('jornada.fecha <= :fin', { fin: finMes })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .getCount();

    return {
      cumplimientoPlan,
      coberturaTerritorial,
      jornadasConEvidencia,
      jornadasMesActual,
    };
  }

  async obtenerActividadMensual(
    meses = 6,
  ): Promise<SerieMensualDashboardDto[]> {
    const ahora = new Date();
    const inicio = new Date(
      ahora.getFullYear(),
      ahora.getMonth() - (meses - 1),
      1,
    );

    const jornadasPorMes = await this.jornadaRepository
      .createQueryBuilder('jornada')
      .select(`EXTRACT(YEAR FROM jornada.fecha)`, 'anio')
      .addSelect(`EXTRACT(MONTH FROM jornada.fecha)`, 'mes')
      .addSelect('COUNT(*)', 'total')
      .where('jornada.fecha >= :inicio', { inicio })
      .andWhere('jornada.estado != :cancelada', {
        cancelada: EstadoJornada.CANCELADA,
      })
      .groupBy('anio')
      .addGroupBy('mes')
      .getRawMany<{ anio: string; mes: string; total: string }>();

    const formulariosPorMes = await this.envioRepository
      .createQueryBuilder('envio')
      .select(`EXTRACT(YEAR FROM envio.enviado_en)`, 'anio')
      .addSelect(`EXTRACT(MONTH FROM envio.enviado_en)`, 'mes')
      .addSelect('COUNT(*)', 'total')
      .where('envio.enviado_en >= :inicio', { inicio })
      .groupBy('anio')
      .addGroupBy('mes')
      .getRawMany<{ anio: string; mes: string; total: string }>();

    const beneficiariosPorMes = await this.jornadaRepository
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
      .addGroupBy('mes')
      .getRawMany<{ anio: string; mes: string; total: string }>();

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

  async obtenerProgresoProyectos(): Promise<ProgresoProyectoDashboardDto[]> {
    const activos = await this.proyectoRepository.find({
      where: { estado: EstadoProyecto.ACTIVO },
      order: { actualizadoEn: 'DESC' },
      take: 12,
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

  async obtenerMapaCobertura(): Promise<VeredaCoberturaDto[]> {
    const proyectos = await this.proyectoRepository.find({
      where: [
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

    const centroides = await this.jornadaRepository
      .createQueryBuilder('jornada')
      .select('jornada.vereda_id', 'veredaId')
      .addSelect('AVG(jornada.latitud)', 'latitud')
      .addSelect('AVG(jornada.longitud)', 'longitud')
      .where('jornada.vereda_id IN (:...ids)', {
        ids: [...porVereda.keys()],
      })
      .andWhere('jornada.latitud IS NOT NULL')
      .andWhere('jornada.longitud IS NOT NULL')
      .groupBy('jornada.vereda_id')
      .getRawMany<{ veredaId: string; latitud: string; longitud: string }>();

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

  async obtenerSeguimientoDestacado(): Promise<SeguimientoCampoDashboardDto | null> {
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
      .getRawOne<{ proyectoId: string; nombreProyecto: string; total: string }>();

    if (!candidatos) return null;

    const jornadas = await this.jornadaRepository.find({
      where: {
        proyecto: { id: candidatos.proyectoId },
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
      fecha: j.fecha
        ? new Date(j.fecha).toISOString().slice(0, 10)
        : undefined,
      descripcion: j.observaciones || j.nombre || '',
    }));

    return {
      proyectoId: candidatos.proyectoId,
      nombreProyecto: candidatos.nombreProyecto,
      jornadas: puntos,
      progresoAvancePorcentaje:
        conGeo.length > 0
          ? Math.round((completadas / conGeo.length) * 100)
          : 0,
    };
  }

  async obtenerJornadasRecientes(
    limite = 5,
  ): Promise<JornadaRecienteDashboardDto[]> {
    const jornadas = await this.jornadaRepository.find({
      where: {},
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
        fecha: j.fecha
          ? new Date(j.fecha).toISOString().slice(0, 10)
          : '',
      }));
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
