/** Estado de revisión / trazabilidad (independiente del estado de ejecución de campo). */
export enum EstadoFuncional {
  BORRADOR = 'BORRADOR',
  CAPTURADO = 'CAPTURADO',
  SINCRONIZADO = 'SINCRONIZADO',
  EN_REVISION = 'EN_REVISION',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  EN_CORRECCION = 'EN_CORRECCION',
}
