import { Actividad } from '../entities/actividad.entity';
import { Meta } from '../entities/meta.entity';
import { Proceso } from '../entities/proceso.entity';
import { Subactividad } from '../entities/subactividad.entity';
import { EstadoAvanceActividad } from '../enums/estado-avance-actividad.enum';
import {
  RespuestaActividadDto,
  RespuestaCompletadaPorDto,
  RespuestaMetaPeriodoPlanDto,
  RespuestaMetaPlanDto,
  RespuestaPlanProyectoDto,
  RespuestaProcesoPlanDto,
  RespuestaProgresoProyectoDto,
  RespuestaSubactividadDto,
} from '../dto/respuesta-actividad.dto';

function aCompletadaPor(
  usuario?: { id: string; nombreCompleto: string } | null,
): RespuestaCompletadaPorDto | undefined {
  if (!usuario) {
    return undefined;
  }

  return {
    id: usuario.id,
    nombreCompleto: usuario.nombreCompleto,
  };
}

function progresoMeta(meta: Meta, ejecutadoTotal: number): number {
  const cantidadTotal = Number(meta.cantidadTotal);
  if (cantidadTotal <= 0) return 0;
  return Math.min(
    100,
    Math.round((ejecutadoTotal / cantidadTotal) * 10000) / 100,
  );
}

function aRespuestaMetaPlan(
  meta: Meta,
  ejecutadoPorMeta: Map<string, number>,
): RespuestaMetaPlanDto {
  const ejecutadoTotal = ejecutadoPorMeta.get(meta.id) ?? 0;

  return {
    id: meta.id,
    nombre: meta.nombre,
    unidadMedida: meta.unidadMedida,
    cantidadTotal: Number(meta.cantidadTotal),
    orden: meta.orden,
    estaActivo: meta.estaActivo,
    ejecutadoTotal,
    progresoPorcentaje: progresoMeta(meta, ejecutadoTotal),
    periodos: (meta.periodos ?? [])
      .sort((a, b) =>
        a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes,
      )
      .map(
        (p): RespuestaMetaPeriodoPlanDto => ({
          id: p.id,
          anio: p.anio,
          mes: p.mes,
          cantidadPlaneada: Number(p.cantidadPlaneada),
        }),
      ),
  };
}

function progresoProceso(
  proceso: Proceso,
  ejecutadoPorMeta: Map<string, number>,
): number {
  const metas = (proceso.metas ?? []).filter((m) => m.estaActivo);
  if (!metas.length) return 0;

  const progresos = metas.map((m) =>
    progresoMeta(m, ejecutadoPorMeta.get(m.id) ?? 0),
  );
  return Math.round(progresos.reduce((acc, p) => acc + p, 0) / progresos.length);
}

function aRespuestaProcesoPlan(
  proceso: Proceso,
  ejecutadoPorMeta: Map<string, number>,
): RespuestaProcesoPlanDto {
  const metas = (proceso.metas ?? [])
    .filter((m) => m.estaActivo)
    .sort((a, b) => a.orden - b.orden)
    .map((m) => aRespuestaMetaPlan(m, ejecutadoPorMeta));

  return {
    id: proceso.id,
    nombre: proceso.nombre,
    descripcion: proceso.descripcion,
    orden: proceso.orden,
    estaActivo: proceso.estaActivo,
    progresoPorcentaje: progresoProceso(proceso, ejecutadoPorMeta),
    metas,
  };
}

export function progresoSubactividad(
  sub: Subactividad,
  ejecutadoPorMeta: Map<string, number> = new Map(),
): number {
  const procesos = (sub.procesos ?? []).filter((p) => p.estaActivo);

  if (procesos.length > 0) {
    const progresos = procesos.map((p) => progresoProceso(p, ejecutadoPorMeta));
    return Math.round(progresos.reduce((acc, p) => acc + p, 0) / progresos.length);
  }

  return sub.estadoAvance === EstadoAvanceActividad.COMPLETADA ? 100 : 0;
}

export function progresoActividad(
  act: Actividad,
  ejecutadoPorMeta: Map<string, number> = new Map(),
): number {
  const subs = act.subactividades?.filter((s) => s.estaActivo) ?? [];

  if (subs.length > 0) {
    const suma = subs.reduce(
      (acc, sub) => acc + progresoSubactividad(sub, ejecutadoPorMeta),
      0,
    );
    return Math.round(suma / subs.length);
  }

  return act.estadoAvance === EstadoAvanceActividad.COMPLETADA ? 100 : 0;
}

export function progresoProyecto(
  actividades: Actividad[],
  ejecutadoPorMeta: Map<string, number> = new Map(),
): number {
  const activas = actividades.filter((act) => act.estaActivo);

  if (!activas.length) {
    return 0;
  }

  const suma = activas.reduce(
    (acc, act) => acc + progresoActividad(act, ejecutadoPorMeta),
    0,
  );
  return Math.round(suma / activas.length);
}

export function actividadesCompletadas(
  actividades: Actividad[],
  ejecutadoPorMeta: Map<string, number> = new Map(),
): number {
  return actividades.filter(
    (act) =>
      act.estaActivo && progresoActividad(act, ejecutadoPorMeta) === 100,
  ).length;
}

function aRespuestaSubactividad(
  sub: Subactividad,
  ejecutadoPorMeta: Map<string, number>,
): RespuestaSubactividadDto {
  const procesos = (sub.procesos ?? [])
    .filter((p) => p.estaActivo)
    .sort((a, b) => a.orden - b.orden)
    .map((p) => aRespuestaProcesoPlan(p, ejecutadoPorMeta));

  return {
    id: sub.id,
    nombre: sub.nombre,
    descripcion: sub.descripcion,
    objetivo: sub.objetivo,
    orden: sub.orden,
    estaActivo: sub.estaActivo,
    estadoAvance: sub.estadoAvance,
    notaCompletado: sub.notaCompletado,
    completadaEn: sub.completadaEn,
    completadaPor: aCompletadaPor(sub.completadaPor),
    progresoPorcentaje: progresoSubactividad(sub, ejecutadoPorMeta),
    procesos: procesos.length > 0 ? procesos : undefined,
  };
}

export function aRespuestaActividad(
  act: Actividad,
  ejecutadoPorMeta: Map<string, number> = new Map(),
): RespuestaActividadDto {
  return {
    id: act.id,
    nombre: act.nombre,
    descripcion: act.descripcion,
    orden: act.orden,
    estaActivo: act.estaActivo,
    estadoAvance: act.estadoAvance,
    notaCompletado: act.notaCompletado,
    completadaEn: act.completadaEn,
    completadaPor: aCompletadaPor(act.completadaPor),
    progresoPorcentaje: progresoActividad(act, ejecutadoPorMeta),
    subactividades: act.subactividades
      ?.filter((sub) => sub.estaActivo)
      .sort((a, b) => a.orden - b.orden)
      .map((sub) => aRespuestaSubactividad(sub, ejecutadoPorMeta)),
  };
}

export function aRespuestaPlan(
  proyectoId: string,
  actividades: Actividad[],
  ejecutadoPorMeta: Map<string, number> = new Map(),
): RespuestaPlanProyectoDto {
  const activas = actividades
    .filter((act) => act.estaActivo)
    .sort((a, b) => a.orden - b.orden)
    .map((act) => aRespuestaActividad(act, ejecutadoPorMeta));

  return {
    proyectoId,
    actividades: activas,
    progresoPorcentaje: progresoProyecto(actividades, ejecutadoPorMeta),
  };
}

export function aRespuestaProgreso(
  proyectoId: string,
  actividades: Actividad[],
  ejecutadoPorMeta: Map<string, number> = new Map(),
): RespuestaProgresoProyectoDto {
  const activas = actividades.filter((act) => act.estaActivo);

  return {
    proyectoId,
    progresoPorcentaje: progresoProyecto(actividades, ejecutadoPorMeta),
    actividadesTotal: activas.length,
    actividadesCompletadas: actividadesCompletadas(
      actividades,
      ejecutadoPorMeta,
    ),
  };
}
