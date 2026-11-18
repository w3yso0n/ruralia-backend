import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { FaseFormulario } from '../../formularios/enums/fase-formulario.enum';

/**
 * Las jornadas de línea base no cuentan en ninguna métrica: avance del plan,
 * Gantt, KPIs, dashboard, evaluaciones, reportes ni expediente. Toda consulta
 * de ese tipo debe pasar por aquí (o usar `FILTRO_EJECUCION` en un find).
 */
export function soloEjecucion<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias = 'jornada',
): SelectQueryBuilder<T> {
  return qb.andWhere(`${alias}.fase = :faseEjecucion`, {
    faseEjecucion: FaseFormulario.EJECUCION,
  });
}

/** Condición SQL cruda para subconsultas y `innerJoin(..., condición)`. */
export function sqlSoloEjecucion(alias = 'jornada'): string {
  return `${alias}.fase = '${FaseFormulario.EJECUCION}'`;
}

/** Para `find({ where })`. */
export const FILTRO_EJECUCION = { fase: FaseFormulario.EJECUCION } as const;

export function esLineaBase(jornada: {
  fase?: FaseFormulario | null;
}): boolean {
  return jornada.fase === FaseFormulario.LINEA_BASE;
}
