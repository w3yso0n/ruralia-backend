export const ACCIONES_CRONOLOGIA = [
  'JORNADA_CREADA',
  'JORNADA_ESTADO_CAMBIADO',
  'JORNADA_CANCELADA',
  'FORMULARIO_ENVIADO',
  'ACTIVIDAD_COMPLETADA',
  'SUBACTIVIDAD_COMPLETADA',
] as const;

export type AccionCronologia = (typeof ACCIONES_CRONOLOGIA)[number];

export const ENTIDADES_CRONOLOGIA = [
  'jornada',
  'envio_formulario',
  'actividad',
  'subactividad',
] as const;

export type EntidadCronologia = (typeof ENTIDADES_CRONOLOGIA)[number];

export type OrigenCronologia = 'api' | 'sync' | 'seed_demo';

export function esAccionCronologia(valor: string): valor is AccionCronologia {
  return (ACCIONES_CRONOLOGIA as readonly string[]).includes(valor);
}
