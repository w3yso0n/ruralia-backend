/**
 * Fase a la que pertenece un formulario y, por herencia, sus jornadas.
 *
 * - EJECUCION: jornadas del plan (meta, subactividad, avance, KPIs, PDF).
 * - LINEA_BASE: levantamiento previo de información del beneficiario. No
 *   cuenta en métricas, avance, Gantt, evaluaciones ni expediente.
 *
 * Se guarda como varchar (no enum de Postgres) para que agregar una fase
 * nueva no dependa de que el synchronize altere el tipo.
 */
export enum FaseFormulario {
  EJECUCION = 'EJECUCION',
  LINEA_BASE = 'LINEA_BASE',
}

export const FASES_FORMULARIO = Object.values(FaseFormulario);
