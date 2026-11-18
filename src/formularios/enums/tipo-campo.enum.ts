export enum TipoCampo {
  TEXTO = 'TEXTO',
  NUMERO = 'NUMERO',
  FECHA = 'FECHA',
  SI_NO = 'SI_NO',
  SELECCION_UNICA = 'SELECCION_UNICA',
  SELECCION_MULTIPLE = 'SELECCION_MULTIPLE',
  GPS = 'GPS',
  FOTO = 'FOTO',
  FIRMA = 'FIRMA',
  ARCHIVO = 'ARCHIVO',
  /** Matriz/lista repetible (p. ej. asistencia). Columnas en opciones; filas en valorJson. */
  TABLA = 'TABLA',
  /**
   * Selector en cascada departamento -> municipio -> vereda PDET (catálogo
   * `veredas_pdet`, distinto de la vereda DANE). Respuesta en valorJson:
   * `{ veredaPdetId, codigo, nombre, municipioCodigo }`.
   */
  VEREDA_PDET = 'VEREDA_PDET',
}
