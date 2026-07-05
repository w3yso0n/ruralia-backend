import { Actividad } from '../entities/actividad.entity';
import { Subactividad } from '../entities/subactividad.entity';
import { EstadoAvanceActividad } from '../enums/estado-avance-actividad.enum';
import {
  RespuestaActividadDto,
  RespuestaCompletadaPorDto,
  RespuestaPlanProyectoDto,
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

export function progresoSubactividad(sub: Subactividad): number {
  return sub.estadoAvance === EstadoAvanceActividad.COMPLETADA ? 100 : 0;
}

export function progresoActividad(act: Actividad): number {
  const subs = act.subactividades?.filter((s) => s.estaActivo) ?? [];

  if (subs.length > 0) {
    const suma = subs.reduce((acc, sub) => acc + progresoSubactividad(sub), 0);
    return Math.round(suma / subs.length);
  }

  return act.estadoAvance === EstadoAvanceActividad.COMPLETADA ? 100 : 0;
}

export function progresoProyecto(actividades: Actividad[]): number {
  const activas = actividades.filter((act) => act.estaActivo);

  if (!activas.length) {
    return 0;
  }

  const suma = activas.reduce((acc, act) => acc + progresoActividad(act), 0);
  return Math.round(suma / activas.length);
}

export function actividadesCompletadas(actividades: Actividad[]): number {
  return actividades.filter(
    (act) => act.estaActivo && progresoActividad(act) === 100,
  ).length;
}

function aRespuestaSubactividad(sub: Subactividad): RespuestaSubactividadDto {
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
    progresoPorcentaje: progresoSubactividad(sub),
  };
}

export function aRespuestaActividad(act: Actividad): RespuestaActividadDto {
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
    progresoPorcentaje: progresoActividad(act),
    subactividades: act.subactividades
      ?.filter((sub) => sub.estaActivo)
      .sort((a, b) => a.orden - b.orden)
      .map(aRespuestaSubactividad),
  };
}

export function aRespuestaPlan(
  proyectoId: string,
  actividades: Actividad[],
): RespuestaPlanProyectoDto {
  const activas = actividades
    .filter((act) => act.estaActivo)
    .sort((a, b) => a.orden - b.orden)
    .map(aRespuestaActividad);

  return {
    proyectoId,
    actividades: activas,
    progresoPorcentaje: progresoProyecto(actividades),
  };
}

export function aRespuestaProgreso(
  proyectoId: string,
  actividades: Actividad[],
): RespuestaProgresoProyectoDto {
  const activas = actividades.filter((act) => act.estaActivo);

  return {
    proyectoId,
    progresoPorcentaje: progresoProyecto(actividades),
    actividadesTotal: activas.length,
    actividadesCompletadas: actividadesCompletadas(actividades),
  };
}
