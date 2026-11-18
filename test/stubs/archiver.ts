/**
 * Sustituto de `archiver` (solo ESM, Jest no lo transforma) para las pruebas
 * de integración: no generan ZIP del expediente.
 */
export class ZipArchive {
  constructor() {
    throw new Error(
      'archiver no está disponible en las pruebas de integración',
    );
  }
}
export default ZipArchive;
