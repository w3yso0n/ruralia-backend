import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actividad } from '../actividades/entities/actividad.entity';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { EstadoJornada } from '../jornadas/enums/estado-jornada.enum';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { FiltrosReporteBeneficiariosDto } from './dto/reportes.dto';
import {
  compararMes,
  enumerarMeses,
  etiquetaMesCorto,
  generarExcelSeguimiento,
  mesDesdeDate,
  type FilaProcesoSeguimiento,
  type MesColumna,
} from './utils/generar-excel-seguimiento';
import {
  diasEnMes,
  generarExcelSeguimientoDiario,
  type FilaSeguimientoDiario,
} from './utils/generar-excel-seguimiento-diario';

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(Beneficiario)
    private readonly beneficiarioRepository: Repository<Beneficiario>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
    @InjectRepository(Actividad)
    private readonly actividadRepository: Repository<Actividad>,
    @InjectRepository(Subactividad)
    private readonly subactividadRepository: Repository<Subactividad>,
    @InjectRepository(PlantillaFormulario)
    private readonly plantillaRepository: Repository<PlantillaFormulario>,
  ) {}

  async resumenProyecto(proyectoId: string) {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
      relations: { creador: true, veredas: true, personal: true },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }

    const conteoJornadas = await this.jornadaRepository.countBy({
      proyecto: { id: proyectoId },
    });

    const conteoBeneficiarios = await this.proyectoRepository
      .createQueryBuilder('proyecto')
      .innerJoin('proyecto.proyectoBeneficiarios', 'pb')
      .where('proyecto.id = :proyectoId', { proyectoId })
      .getCount();

    const conteoFormularios = await this.envioRepository
      .createQueryBuilder('envio')
      .innerJoin('envio.jornada', 'jornada')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .getCount();

    const conteoEvidencias = await this.evidenciaRepository
      .createQueryBuilder('evidencia')
      .innerJoin('evidencia.jornada', 'jornada')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .getCount();

    const conteoActividades = await this.actividadRepository.countBy({
      proyecto: { id: proyectoId },
    });

    return {
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.nombre,
        tipo: proyecto.tipo,
        estado: proyecto.estado,
        fechaInicio: proyecto.fechaInicio,
        fechaFin: proyecto.fechaFin,
      },
      territoriosCubiertos: proyecto.veredas?.length ?? 0,
      veredas: proyecto.veredas?.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        codigo: v.codigo,
      })),
      personal: proyecto.personal?.map((u) => ({
        id: u.id,
        nombreCompleto: u.nombreCompleto,
        correo: u.correo,
      })),
      conteos: {
        jornadas: conteoJornadas,
        beneficiarios: conteoBeneficiarios,
        formularios: conteoFormularios,
        evidencias: conteoEvidencias,
        actividades: conteoActividades,
      },
    };
  }

  async reporteBeneficiarios(
    proyectoId: string,
    filtros: FiltrosReporteBeneficiariosDto,
  ) {
    await this.verificarProyecto(proyectoId);

    const query = this.beneficiarioRepository
      .createQueryBuilder('beneficiario')
      .innerJoin(
        'beneficiario.proyectoBeneficiarios',
        'pb',
        'pb.proyecto_id = :proyectoId',
        { proyectoId },
      )
      .leftJoinAndSelect('beneficiario.vereda', 'vereda');

    if (filtros.veredaId) {
      query.andWhere('beneficiario.vereda_id = :veredaId', {
        veredaId: filtros.veredaId,
      });
    }

    if (filtros.busqueda) {
      query.andWhere(
        '(beneficiario.nombres ILIKE :busqueda OR beneficiario.apellidos ILIKE :busqueda OR beneficiario.numero_documento ILIKE :busqueda)',
        { busqueda: `%${filtros.busqueda}%` },
      );
    }

    const beneficiarios = await query.getMany();
    const resultado: Record<string, unknown>[] = [];

    for (const beneficiario of beneficiarios) {
      const jornadasAtendidas = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .innerJoin('jornada.beneficiarios', 'b', 'b.id = :beneficiarioId', {
          beneficiarioId: beneficiario.id,
        })
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .getCount();

      resultado.push({
        id: beneficiario.id,
        nombres: beneficiario.nombres,
        apellidos: beneficiario.apellidos,
        numeroDocumento: beneficiario.numeroDocumento,
        vereda: beneficiario.vereda?.nombre,
        jornadasAtendidas,
        formularios: jornadasAtendidas,
        documentos: beneficiario.numeroDocumento,
      });
    }

    return resultado;
  }

  async avanceActividades(proyectoId: string) {
    await this.verificarProyecto(proyectoId);

    const actividades = await this.actividadRepository.find({
      where: { proyecto: { id: proyectoId } },
      relations: { subactividades: true },
    });

    const resultado: Record<string, unknown>[] = [];

    for (const actividad of actividades) {
      const jornadasPlanificadas = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .innerJoin('jornada.jornadaActividades', 'ja')
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .andWhere('ja.actividad_id = :actividadId', { actividadId: actividad.id })
        .andWhere('jornada.estado = :estado', { estado: EstadoJornada.PLANIFICADA })
        .getCount();

      const jornadasEjecutadas = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .innerJoin('jornada.jornadaActividades', 'ja')
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .andWhere('ja.actividad_id = :actividadId', { actividadId: actividad.id })
        .andWhere('jornada.estado IN (:...estados)', {
          estados: [EstadoJornada.COMPLETADA, EstadoJornada.EN_PROGRESO],
        })
        .getCount();

      const subactividadesDetalle: Record<string, unknown>[] = [];

      for (const sub of actividad.subactividades ?? []) {
        const plantillasActivas = await this.plantillaRepository
          .createQueryBuilder('plantilla')
          .innerJoin('plantilla.subactividades', 'subactividad')
          .where('subactividad.id = :subactividadId', { subactividadId: sub.id })
          .andWhere('plantilla.esta_activo = true')
          .getCount();

        const formulariosRecibidos = await this.envioRepository
          .createQueryBuilder('envio')
          .innerJoin('envio.jornada', 'jornada')
          .innerJoin('envio.plantillaFormulario', 'plantilla')
          .innerJoin('plantilla.subactividades', 'subactividad')
          .where('jornada.proyecto_id = :proyectoId', { proyectoId })
          .andWhere('subactividad.id = :subactividadId', {
            subactividadId: sub.id,
          })
          .getCount();

        subactividadesDetalle.push({
          id: sub.id,
          nombre: sub.nombre,
          formulariosEsperados: plantillasActivas,
          formulariosRecibidos,
        });
      }

      resultado.push({
        actividadId: actividad.id,
        actividadNombre: actividad.nombre,
        jornadasPlanificadas,
        jornadasEjecutadas,
        subactividades: subactividadesDetalle,
      });
    }

    return resultado;
  }

  async mapaCalorTerritorio(proyectoId: string) {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
      relations: { veredas: true },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }

    const veredaIds = proyecto.veredas?.map((v) => v.id) ?? [];

    if (!veredaIds.length) {
      return [];
    }

    const resultado: Record<string, unknown>[] = [];

    for (const vereda of proyecto.veredas ?? []) {
      const conteoBeneficiarios = await this.beneficiarioRepository.countBy({
        vereda: { id: vereda.id },
      });

      const conteoJornadas = await this.jornadaRepository.countBy({
        proyecto: { id: proyectoId },
        vereda: { id: vereda.id },
      });

      const centroide = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .select('AVG(jornada.latitud)', 'latitud')
        .addSelect('AVG(jornada.longitud)', 'longitud')
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .andWhere('jornada.vereda_id = :veredaId', { veredaId: vereda.id })
        .andWhere('jornada.latitud IS NOT NULL')
        .getRawOne<{ latitud: string; longitud: string }>();

      resultado.push({
        veredaId: vereda.id,
        veredaNombre: vereda.nombre,
        veredaCodigo: vereda.codigo,
        conteoBeneficiarios,
        conteoJornadas,
        latitud: centroide?.latitud ? Number(centroide.latitud) : null,
        longitud: centroide?.longitud ? Number(centroide.longitud) : null,
      });
    }

    return resultado;
  }

  /**
   * Excel Plan/Ejec mensual:
   * - Plan: `meta_periodos.cantidad_planeada` por meta × mes
   * - Ejec: suma de `jornadas.cantidad_ejecutada` (o 1 si COMPLETADA sin cantidad)
   * - Una pareja Plan/Ejec por meta (unidad de medición real del modelo)
   */
  async excelSeguimientoProyecto(proyectoId: string): Promise<{
    buffer: Buffer;
    nombreArchivo: string;
  }> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
    });
    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }

    const actividades = await this.actividadRepository.find({
      where: { proyecto: { id: proyectoId } },
      relations: {
        subactividades: {
          procesos: { metas: { periodos: true } },
        },
      },
      order: {
        orden: 'ASC',
        subactividades: {
          orden: 'ASC',
          procesos: { orden: 'ASC', metas: { orden: 'ASC' } },
        },
      },
    });

    const ejecPorMetaMes = await this.cargarEjecutadoPorMetaMes(proyectoId);
    const meses = await this.resolverRangoMeses(
      proyecto,
      actividades,
      ejecPorMetaMes,
    );

    const hoy = new Date();
    const mesActual: MesColumna = {
      anio: hoy.getFullYear(),
      mes: hoy.getMonth() + 1,
    };
    const indiceMesActual = meses.findIndex(
      (m) => m.anio === mesActual.anio && m.mes === mesActual.mes,
    );

    const filas: FilaProcesoSeguimiento[] = [];

    for (const actividad of actividades) {
      if (!actividad.estaActivo) continue;
      for (const sub of actividad.subactividades ?? []) {
        if (!sub.estaActivo) continue;
        for (const proceso of sub.procesos ?? []) {
          if (!proceso.estaActivo) continue;
          const metas = (proceso.metas ?? []).filter((m) => m.estaActivo);
          // Si el proceso no tiene meta activa, no hay fila (no inventamos datos).
          for (const meta of metas) {
            const planMap = new Map<string, number>();
            for (const p of meta.periodos ?? []) {
              planMap.set(
                `${p.anio}-${p.mes}`,
                Number(p.cantidadPlaneada),
              );
            }

            const planPorMes = meses.map((m) => {
              const clave = `${m.anio}-${m.mes}`;
              return planMap.has(clave) ? planMap.get(clave)! : null;
            });

            const ejecPorMes = meses.map((m) => {
              const clave = `${meta.id}|${m.anio}-${m.mes}`;
              return ejecPorMetaMes.has(clave)
                ? ejecPorMetaMes.get(clave)!
                : null;
            });

            filas.push({
              subactividadNombre: sub.nombre,
              procesoNombre: proceso.nombre,
              metaCantidad: Number(meta.cantidadTotal),
              unidadMedida: meta.unidadMedida,
              planPorMes,
              ejecPorMes,
            });
          }
        }
      }
    }

    const buffer = await generarExcelSeguimiento({
      proyectoNombre: proyecto.nombre,
      meses,
      indiceMesActual,
      filas,
    });

    const slug = proyecto.nombre
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const nombreArchivo = `seguimiento-${slug || proyectoId}.xlsx`;

    return { buffer, nombreArchivo };
  }

  /**
   * Excel Plan/Ejec diario de un mes:
   * - Columnas = días 1..N del mes
   * - Plan: no hay plan diario en el modelo → días vacíos, TOTAL = cantidad_planeada del mes
   * - Ejec: suma de jornadas por meta × día (cantidad_ejecutada / legacy COMPLETADA=1)
   */
  async excelSeguimientoDiarioProyecto(
    proyectoId: string,
    anio: number,
    mes: number,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
    });
    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }

    const actividades = await this.actividadRepository.find({
      where: { proyecto: { id: proyectoId } },
      relations: {
        subactividades: {
          procesos: { metas: { periodos: true } },
        },
      },
      order: {
        orden: 'ASC',
        subactividades: {
          orden: 'ASC',
          procesos: { orden: 'ASC', metas: { orden: 'ASC' } },
        },
      },
    });

    const totalDias = diasEnMes(anio, mes);
    const ejecPorMetaDia = await this.cargarEjecutadoPorMetaDia(
      proyectoId,
      anio,
      mes,
    );

    const hoy = new Date();
    const diaActual =
      hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes
        ? hoy.getDate()
        : -1;

    const filas: FilaSeguimientoDiario[] = [];

    for (const actividad of actividades) {
      if (!actividad.estaActivo) continue;
      for (const sub of actividad.subactividades ?? []) {
        if (!sub.estaActivo) continue;
        for (const proceso of sub.procesos ?? []) {
          if (!proceso.estaActivo) continue;
          for (const meta of (proceso.metas ?? []).filter((m) => m.estaActivo)) {
            const periodoMes = (meta.periodos ?? []).find(
              (p) => p.anio === anio && p.mes === mes,
            );
            const planMes =
              periodoMes != null ? Number(periodoMes.cantidadPlaneada) : null;

            const ejecPorDia: Array<number | null> = [];
            for (let dia = 1; dia <= totalDias; dia++) {
              const clave = `${meta.id}|${dia}`;
              ejecPorDia.push(
                ejecPorMetaDia.has(clave) ? ejecPorMetaDia.get(clave)! : null,
              );
            }

            filas.push({
              subactividadNombre: sub.nombre,
              procesoNombre: proceso.nombre,
              metaCantidad: Number(meta.cantidadTotal),
              unidadMedida: meta.unidadMedida,
              planMes,
              ejecPorDia,
            });
          }
        }
      }
    }

    const buffer = await generarExcelSeguimientoDiario({
      proyectoNombre: proyecto.nombre,
      anio,
      mes,
      diasEnMes: totalDias,
      diaActual,
      filas,
    });

    const slug = proyecto.nombre
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const etiqueta = etiquetaMesCorto(anio, mes);
    const nombreArchivo = `seguimiento-diario-${etiqueta}-${slug || proyectoId}.xlsx`;

    return { buffer, nombreArchivo };
  }

  private async cargarEjecutadoPorMetaMes(
    proyectoId: string,
  ): Promise<Map<string, number>> {
    const filas = await this.jornadaRepository
      .createQueryBuilder('jornada')
      .select('jornada.meta_id', 'metaId')
      .addSelect('EXTRACT(YEAR FROM jornada.fecha)::int', 'anio')
      .addSelect('EXTRACT(MONTH FROM jornada.fecha)::int', 'mes')
      .addSelect(
        `COALESCE(SUM(
          CASE
            WHEN jornada.cantidad_ejecutada IS NOT NULL THEN jornada.cantidad_ejecutada
            WHEN jornada.estado = :estadoCompletada THEN 1
            ELSE 0
          END
        ), 0)`,
        'total',
      )
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('jornada.estado != :estadoCancelada', {
        estadoCancelada: EstadoJornada.CANCELADA,
      })
      .andWhere('jornada.meta_id IS NOT NULL')
      .setParameter('estadoCompletada', EstadoJornada.COMPLETADA)
      .groupBy('jornada.meta_id')
      .addGroupBy('EXTRACT(YEAR FROM jornada.fecha)')
      .addGroupBy('EXTRACT(MONTH FROM jornada.fecha)')
      .getRawMany<{
        metaId: string;
        anio: string | number;
        mes: string | number;
        total: string;
      }>();

    const mapa = new Map<string, number>();
    for (const fila of filas) {
      const anio = Number(fila.anio);
      const mes = Number(fila.mes);
      mapa.set(`${fila.metaId}|${anio}-${mes}`, Number(fila.total));
    }
    return mapa;
  }

  /** Ejecutado por meta × día del mes (clave: `metaId|dia`). */
  private async cargarEjecutadoPorMetaDia(
    proyectoId: string,
    anio: number,
    mes: number,
  ): Promise<Map<string, number>> {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0);

    const filas = await this.jornadaRepository
      .createQueryBuilder('jornada')
      .select('jornada.meta_id', 'metaId')
      .addSelect('EXTRACT(DAY FROM jornada.fecha)::int', 'dia')
      .addSelect(
        `COALESCE(SUM(
          CASE
            WHEN jornada.cantidad_ejecutada IS NOT NULL THEN jornada.cantidad_ejecutada
            WHEN jornada.estado = :estadoCompletada THEN 1
            ELSE 0
          END
        ), 0)`,
        'total',
      )
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('jornada.estado != :estadoCancelada', {
        estadoCancelada: EstadoJornada.CANCELADA,
      })
      .andWhere('jornada.meta_id IS NOT NULL')
      .andWhere('jornada.fecha >= :inicio', { inicio })
      .andWhere('jornada.fecha <= :fin', { fin })
      .setParameter('estadoCompletada', EstadoJornada.COMPLETADA)
      .groupBy('jornada.meta_id')
      .addGroupBy('EXTRACT(DAY FROM jornada.fecha)')
      .getRawMany<{
        metaId: string;
        dia: string | number;
        total: string;
      }>();

    const mapa = new Map<string, number>();
    for (const fila of filas) {
      mapa.set(`${fila.metaId}|${Number(fila.dia)}`, Number(fila.total));
    }
    return mapa;
  }

  /**
   * Rango de columnas mensuales:
   * 1) Preferir fechaInicio–fechaFin del proyecto
   * 2) Completar extremos faltantes con periodos planeados y jornadas
   * 3) Si no hay nada, mes actual
   */
  private async resolverRangoMeses(
    proyecto: Proyecto,
    actividades: Actividad[],
    ejecPorMetaMes: Map<string, number>,
  ): Promise<MesColumna[]> {
    const candidatos: MesColumna[] = [];

    if (proyecto.fechaInicio) {
      candidatos.push(mesDesdeDate(new Date(proyecto.fechaInicio)));
    }
    if (proyecto.fechaFin) {
      candidatos.push(mesDesdeDate(new Date(proyecto.fechaFin)));
    }

    for (const actividad of actividades) {
      for (const sub of actividad.subactividades ?? []) {
        for (const proceso of sub.procesos ?? []) {
          for (const meta of proceso.metas ?? []) {
            for (const p of meta.periodos ?? []) {
              candidatos.push({ anio: p.anio, mes: p.mes });
            }
          }
        }
      }
    }

    for (const clave of ejecPorMetaMes.keys()) {
      // metaId|YYYY-M
      const parte = clave.split('|')[1];
      if (!parte) continue;
      const [anioStr, mesStr] = parte.split('-');
      candidatos.push({ anio: Number(anioStr), mes: Number(mesStr) });
    }

    if (candidatos.length === 0) {
      return [mesDesdeDate(new Date())];
    }

    candidatos.sort(compararMes);
    let inicio = candidatos[0];
    let fin = candidatos[candidatos.length - 1];

    // Si el proyecto tiene ambas fechas, forzar ese rango (aunque no haya periodos)
    if (proyecto.fechaInicio && proyecto.fechaFin) {
      inicio = mesDesdeDate(new Date(proyecto.fechaInicio));
      fin = mesDesdeDate(new Date(proyecto.fechaFin));
      if (compararMes(inicio, fin) > 0) {
        [inicio, fin] = [fin, inicio];
      }
    }

    return enumerarMeses(inicio, fin);
  }

  private async verificarProyecto(proyectoId: string): Promise<void> {
    const existe = await this.proyectoRepository.existsBy({ id: proyectoId });

    if (!existe) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }
  }
}
