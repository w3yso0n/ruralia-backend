/**
 * Interpretación estricta de la ubicación propia del beneficiario (su predio),
 * tal como llega en las matrices de Excel. No es la ubicación de la vereda.
 *
 * Reglas (solo se corrige lo que no admite otra lectura):
 * - Coma o punto como separador decimal ("9,7309" = "9.7309").
 * - Letra de hemisferio: N/S para latitud, W/O/E para longitud.
 * - Grados, minutos y segundos con símbolos (9°42'15").
 * - Longitud positiva sin letra: se toma como oeste, porque todo Colombia
 *   está al oeste de Greenwich (una longitud este caería en Asia).
 * - Números sin separador ("752923") NO se interpretan: pueden ser un punto
 *   decimal perdido (75.2923) o grados-minutos-segundos (75°29'23"), que
 *   quedan a ~20 km de distancia. Quedan pendientes de revisión.
 * - El resultado debe caer dentro de Colombia; si no, queda pendiente.
 */

export type EjeCoordenada = 'latitud' | 'longitud';

export type MotivoCoordenadaInvalida =
  | 'vacia'
  | 'sin_separador_decimal'
  | 'formato_no_reconocido'
  | 'fuera_de_colombia';

export type ResultadoCoordenada =
  | { ok: true; valor: number }
  | { ok: false; motivo: MotivoCoordenadaInvalida };

/** Caja de Colombia continental e insular (San Andrés incluido). */
export const LIMITES_COLOMBIA = {
  latitud: { min: -4.3, max: 13.6 },
  longitud: { min: -82, max: -66.8 },
} as const;

export const ETIQUETA_MOTIVO_COORDENADA: Record<
  MotivoCoordenadaInvalida,
  string
> = {
  vacia: 'Sin valor',
  sin_separador_decimal: 'Número sin separador decimal (ambiguo)',
  formato_no_reconocido: 'Formato no reconocido',
  fuera_de_colombia: 'Queda fuera de Colombia',
};

const DMS =
  /^(\d{1,3})\s*[°º]\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*['’′])?\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:["”″]|''))?$/;

function aNumero(texto: string): number {
  return Number(texto.replace(',', '.'));
}

export function interpretarCoordenada(
  entrada: unknown,
  eje: EjeCoordenada,
): ResultadoCoordenada {
  if (entrada === null || entrada === undefined)
    return { ok: false, motivo: 'vacia' };
  if (typeof entrada === 'number') {
    return validarRango(normalizarSigno(entrada, eje, null), eje);
  }

  if (typeof entrada !== 'string') {
    return { ok: false, motivo: 'formato_no_reconocido' };
  }
  let texto = entrada.trim().toUpperCase();
  if (!texto) return { ok: false, motivo: 'vacia' };

  // Letra de hemisferio al inicio o al final.
  let hemisferio: string | null = null;
  const letra = /^([NSEWO])\s*|\s*([NSEWO])$/.exec(texto);
  if (letra) {
    hemisferio = letra[1] ?? letra[2];
    texto = texto.replace(letra[0], '').trim();
  }
  const validas = eje === 'latitud' ? ['N', 'S'] : ['E', 'W', 'O'];
  if (hemisferio && !validas.includes(hemisferio)) {
    return { ok: false, motivo: 'formato_no_reconocido' };
  }

  let negativo = false;
  if (texto.startsWith('-')) {
    negativo = true;
    texto = texto.slice(1).trim();
  }
  // "75, 1868" -> "75,1868"
  texto = texto.replace(/([.,])\s+(?=\d)/g, '$1');

  let valor: number;
  const dms = DMS.exec(texto);
  if (dms) {
    const grados = Number(dms[1]);
    const minutos = dms[2] ? aNumero(dms[2]) : 0;
    const segundos = dms[3] ? aNumero(dms[3]) : 0;
    if (minutos >= 60 || segundos >= 60) {
      return { ok: false, motivo: 'formato_no_reconocido' };
    }
    valor = grados + minutos / 60 + segundos / 3600;
  } else if (/^\d+$/.test(texto)) {
    // Un número entero solo es válido si ya es la parte entera (ej. "9" o "75").
    if (texto.length > 2) {
      return { ok: false, motivo: 'sin_separador_decimal' };
    }
    valor = Number(texto);
  } else if (/^\d+[.,]\d+$/.test(texto)) {
    valor = aNumero(texto);
  } else {
    return { ok: false, motivo: 'formato_no_reconocido' };
  }

  if (!Number.isFinite(valor))
    return { ok: false, motivo: 'formato_no_reconocido' };
  if (negativo) valor = -valor;
  return validarRango(normalizarSigno(valor, eje, hemisferio), eje);
}

function normalizarSigno(
  valor: number,
  eje: EjeCoordenada,
  hemisferio: string | null,
): number {
  const absoluto = Math.abs(valor);
  if (eje === 'latitud') {
    if (hemisferio === 'S') return -absoluto;
    if (hemisferio === 'N') return absoluto;
    return valor;
  }
  if (hemisferio === 'E') return absoluto;
  // Oeste explícito, o sin letra: en Colombia la longitud siempre es negativa.
  return -absoluto;
}

function validarRango(valor: number, eje: EjeCoordenada): ResultadoCoordenada {
  const { min, max } = LIMITES_COLOMBIA[eje];
  if (valor < min || valor > max)
    return { ok: false, motivo: 'fuera_de_colombia' };
  return { ok: true, valor: Math.round(valor * 1e7) / 1e7 };
}

/** Altitud en metros sobre el nivel del mar. */
export function interpretarAltitud(entrada: unknown): number | null {
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === 'number') return rangoAltitud(entrada);
  if (typeof entrada !== 'string') return null;
  const texto = entrada
    .trim()
    .toUpperCase()
    .replace(/\s*(M\.?S\.?N\.?M\.?|MSNM|M)$/, '');
  if (!/^-?\d+([.,]\d+)?$/.test(texto)) return null;
  return rangoAltitud(aNumero(texto));
}

function rangoAltitud(valor: number): number | null {
  return Number.isFinite(valor) && valor > -100 && valor < 6000 ? valor : null;
}

export type ResultadoUbicacion =
  | { ok: true; latitud: number; longitud: number }
  | {
      ok: false;
      latitud: ResultadoCoordenada;
      longitud: ResultadoCoordenada;
    };

/** Latitud y longitud se aceptan juntas o no se aceptan. */
export function interpretarUbicacion(
  latitud: unknown,
  longitud: unknown,
): ResultadoUbicacion {
  const lat = interpretarCoordenada(latitud, 'latitud');
  const lng = interpretarCoordenada(longitud, 'longitud');
  if (lat.ok && lng.ok)
    return { ok: true, latitud: lat.valor, longitud: lng.valor };
  return { ok: false, latitud: lat, longitud: lng };
}
