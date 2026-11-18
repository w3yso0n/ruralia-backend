import type { Beneficiario } from '../entities/beneficiario.entity';

/**
 * Único punto por donde se escribe la ubicación propia del beneficiario
 * (latitud / longitud / altitud y sus metadatos). No es la ubicación de la
 * vereda.
 *
 * Prioridad de fuentes:
 *   GPS (campo GPS de un formulario de levantamiento) > MANUAL > EXCEL
 * - Un GPS siempre entra, salvo que ya haya un GPS más confiable: una lectura
 *   en vivo no la reemplaza una "última conocida", ni una captura más vieja.
 * - El Excel nunca pisa una ubicación tomada por GPS.
 * - La corrección manual (ficha o revisión en Territorio) siempre entra:
 *   es una decisión deliberada de una persona.
 * Cualquier cambio de coordenadas limpia la confirmación anterior.
 */

export type FuenteUbicacion = 'GPS' | 'MANUAL' | 'EXCEL';

/** Mismos valores que `UbicacionGps.origen` de la app de campo. */
export type OrigenGps = 'GPS' | 'ULTIMA_CONOCIDA' | 'ULTIMA_REGISTRADA';

const ORIGENES_GPS: OrigenGps[] = [
  'GPS',
  'ULTIMA_CONOCIDA',
  'ULTIMA_REGISTRADA',
];

/** Valor de un campo GPS de formulario, tal como lo envía la app. */
export interface PuntoGpsFormulario {
  latitud: number;
  longitud: number;
  precisionMetros: number | null;
  capturadoEn: Date | null;
  origen: OrigenGps;
}

export interface NuevaUbicacion {
  latitud: number;
  longitud: number;
  /** undefined = no tocar la altitud guardada. */
  altitud?: number | null;
  fuente: FuenteUbicacion;
  origenGps?: OrigenGps | null;
  precisionMetros?: number | null;
  capturadaEn?: Date | null;
  envioId?: string | null;
}

function numeroFinito(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string' && valor.trim()) {
    const n = Number(valor.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Lee el valor crudo de un campo GPS (`{ latitud, longitud, precisionMetros,
 * capturadoEn, origen }`, también acepta lat/lng/lon/precision). Devuelve null
 * si no trae un punto geográfico válido. No exige que caiga en Colombia: el
 * GPS es el dato real de campo; si queda lejos, la revisión de Territorio lo
 * marca como dudoso.
 */
export function leerPuntoGps(valor: unknown): PuntoGpsFormulario | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const v = valor as Record<string, unknown>;
  const latitud = numeroFinito(v.latitud ?? v.lat);
  const longitud = numeroFinito(v.longitud ?? v.lng ?? v.lon);
  if (latitud === null || longitud === null) return null;
  if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
    return null;
  }
  // (0, 0) es la lectura vacía típica de un GPS que no fijó posición.
  if (latitud === 0 && longitud === 0) return null;

  const precision = numeroFinito(v.precisionMetros ?? v.precision);
  let capturadoEn: Date | null = null;
  if (typeof v.capturadoEn === 'string') {
    const fecha = new Date(v.capturadoEn);
    if (!Number.isNaN(fecha.getTime())) capturadoEn = fecha;
  }
  const origen = ORIGENES_GPS.includes(v.origen as OrigenGps)
    ? (v.origen as OrigenGps)
    : 'GPS'; // capturas anteriores al campo `origen` eran lectura en vivo

  return {
    latitud,
    longitud,
    precisionMetros: precision !== null && precision >= 0 ? precision : null,
    capturadoEn,
    origen,
  };
}

/** ¿El GPS nuevo debe reemplazar la ubicación actual? */
export function gpsDebeReemplazar(
  actual: Pick<
    Beneficiario,
    | 'latitud'
    | 'ubicacionFuente'
    | 'ubicacionOrigenGps'
    | 'ubicacionCapturadaEn'
  >,
  nuevo: PuntoGpsFormulario,
): boolean {
  if (actual.latitud === null || actual.ubicacionFuente !== 'GPS') return true;
  const actualEnVivo =
    actual.ubicacionOrigenGps !== 'ULTIMA_CONOCIDA' &&
    actual.ubicacionOrigenGps !== 'ULTIMA_REGISTRADA';
  const nuevoEnVivo = nuevo.origen === 'GPS';
  if (actualEnVivo && !nuevoEnVivo) return false;
  if (!actualEnVivo && nuevoEnVivo) return true;
  if (actual.ubicacionCapturadaEn && nuevo.capturadoEn) {
    return nuevo.capturadoEn.getTime() >= actual.ubicacionCapturadaEn.getTime();
  }
  return true;
}

/** Escribe la ubicación y sus metadatos en la entidad (no guarda en BD). */
export function aplicarUbicacion(
  beneficiario: Beneficiario,
  nueva: NuevaUbicacion,
): void {
  const cambiaPunto =
    beneficiario.latitud !== nueva.latitud ||
    beneficiario.longitud !== nueva.longitud;

  beneficiario.latitud = nueva.latitud;
  beneficiario.longitud = nueva.longitud;
  if (nueva.altitud !== undefined) beneficiario.altitud = nueva.altitud;
  beneficiario.ubicacionFuente = nueva.fuente;
  beneficiario.ubicacionOrigenGps =
    nueva.fuente === 'GPS' ? (nueva.origenGps ?? 'GPS') : null;
  beneficiario.ubicacionPrecisionMetros =
    nueva.fuente === 'GPS' ? (nueva.precisionMetros ?? null) : null;
  beneficiario.ubicacionCapturadaEn = nueva.capturadaEn ?? new Date();
  beneficiario.ubicacionEnvioId =
    nueva.fuente === 'GPS' ? (nueva.envioId ?? null) : null;

  if (cambiaPunto) {
    beneficiario.ubicacionConfirmadaEn = null;
    beneficiario.ubicacionConfirmadaPorId = null;
  }
}

/** Borra la ubicación propia y todos sus metadatos. */
export function quitarUbicacion(beneficiario: Beneficiario): void {
  beneficiario.latitud = null;
  beneficiario.longitud = null;
  beneficiario.altitud = null;
  beneficiario.ubicacionFuente = null;
  beneficiario.ubicacionOrigenGps = null;
  beneficiario.ubicacionPrecisionMetros = null;
  beneficiario.ubicacionCapturadaEn = null;
  beneficiario.ubicacionEnvioId = null;
  beneficiario.ubicacionConfirmadaEn = null;
  beneficiario.ubicacionConfirmadaPorId = null;
}
