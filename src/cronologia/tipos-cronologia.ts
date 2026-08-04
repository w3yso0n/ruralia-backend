export const ACCIONES_CRONOLOGIA = [
  'JORNADA_CREADA',
  'JORNADA_ESTADO_CAMBIADO',
  'JORNADA_CANCELADA',
  'FORMULARIO_ENVIADO',
  'ACTIVIDAD_COMPLETADA',
  'SUBACTIVIDAD_COMPLETADA',
  'JORNADA_ENVIADA_REVISION',
  'JORNADA_REENVIADA_REVISION',
  'JORNADA_SUBIDA_PROYECTO',
  'JORNADA_APROBADA',
  'JORNADA_RECHAZADA',
  'DOCUMENTO_VERSION_CREADA',
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
