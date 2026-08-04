import { AccionCronologia } from './tipos-cronologia';

export interface ContextoTituloCronologia {
  nombreJornadaFecha?: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  nombrePlantilla?: string;
  nombreActividad?: string;
  nombreSubactividad?: string;
}

export function formatearTitulo(
  accion: AccionCronologia,
  contexto: ContextoTituloCronologia = {},
): string {
  switch (accion) {
    case 'JORNADA_CREADA':
      return contexto.nombreJornadaFecha
        ? `Creó jornada del ${contexto.nombreJornadaFecha}`
        : 'Creó una jornada';
    case 'JORNADA_ESTADO_CAMBIADO':
      if (contexto.estadoAnterior && contexto.estadoNuevo) {
        return `Cambió jornada de ${contexto.estadoAnterior} a ${contexto.estadoNuevo}`;
      }
      return 'Cambió el estado de una jornada';
    case 'JORNADA_CANCELADA':
      return contexto.nombreJornadaFecha
        ? `Canceló jornada del ${contexto.nombreJornadaFecha}`
        : 'Canceló una jornada';
    case 'FORMULARIO_ENVIADO':
      return contexto.nombrePlantilla
        ? `Envió formulario «${contexto.nombrePlantilla}»`
        : 'Envió un formulario';
    case 'ACTIVIDAD_COMPLETADA':
      return contexto.nombreActividad
        ? `Completó actividad «${contexto.nombreActividad}»`
        : 'Completó una actividad';
    case 'SUBACTIVIDAD_COMPLETADA':
      return contexto.nombreSubactividad
        ? `Completó subactividad «${contexto.nombreSubactividad}»`
        : 'Completó una subactividad';
    case 'JORNADA_ENVIADA_REVISION':
      return 'Envió jornada a revisión';
    case 'JORNADA_REENVIADA_REVISION':
      return 'Reenvió jornada a revisión';
    case 'JORNADA_SUBIDA_PROYECTO':
      return 'Subió jornada al proyecto';
    case 'JORNADA_APROBADA':
      return 'Aprobó la jornada';
    case 'JORNADA_RECHAZADA':
      return 'Rechazó la jornada';
    case 'DOCUMENTO_VERSION_CREADA':
      return 'Generó nueva versión de documento';
    default:
      return 'Evento de campo';
  }
}
