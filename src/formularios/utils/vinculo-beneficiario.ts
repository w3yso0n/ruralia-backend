/**
 * Vínculo de una pregunta de línea base con un dato del beneficiario.
 *
 * `destino` sigue la nomenclatura del autocompletado (`beneficiario.<campo>`
 * o `beneficiario.extra.<clave>`), así la misma pregunta puede leer y escribir
 * el mismo dato.
 *
 * `permitirCambio`: hoy siempre false. La pregunta se autocompleta con el
 * valor actual y el técnico no la puede modificar; si el beneficiario aún no
 * tiene el dato, el técnico lo captura y al aprobar se guarda. Para permitir
 * que el técnico corrija un valor existente basta con ponerlo en true y
 * respetarlo en el autocompletado (web y app).
 */
export interface VinculoBeneficiario {
  destino: string;
  permitirCambio?: boolean;
}
