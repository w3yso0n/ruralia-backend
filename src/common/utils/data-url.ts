import { createHash } from 'crypto';

/**
 * Adjuntos de formulario (FOTO, FIRMA, ARCHIVO) que llegan como data URL.
 * La app agrega el nombre original como parámetro:
 * `data:application/pdf;name=acta%20final.pdf;base64,JVBERi0...`.
 */
export interface DataUrlArchivo {
  mime: string;
  nombre: string | null;
  base64: string;
  tamano: number;
}

const PATRON = /^data:([^;,]+)((?:;[^;,]*)*?);base64,/i;

export function leerDataUrl(
  valor: string | null | undefined,
): DataUrlArchivo | null {
  if (!valor) return null;
  const texto = valor.trim();
  const data = PATRON.exec(texto);
  if (!data) return null;
  const crudo = /;name=([^;,]*)/i.exec(data[2] ?? '')?.[1];
  let nombre: string | null = null;
  if (crudo) {
    try {
      nombre = decodeURIComponent(crudo);
    } catch {
      nombre = crudo;
    }
  }
  const base64 = texto.slice(data[0].length);
  return {
    mime: data[1].toLowerCase(),
    nombre,
    base64,
    tamano:
      Math.floor((base64.length * 3) / 4) -
      (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0),
  };
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Texto corto para mostrar o auditar un adjunto sin copiar su contenido.
 * Las imágenes se devuelven como data URL simple (sin parámetros) para que el
 * PDF las pueda dibujar.
 */
export function valorLegibleAdjunto(valor: string): string {
  const datos = leerDataUrl(valor);
  if (!datos) return valor;
  if (datos.mime.startsWith('image/')) {
    return `data:${datos.mime};base64,${datos.base64}`;
  }
  const nombre = datos.nombre ?? 'Archivo adjunto';
  return `${nombre} (${formatearTamano(datos.tamano)})`;
}

/** Huella estable de un adjunto: permite saber si cambió sin guardar el contenido. */
export function huellaAdjunto(valor: string): string {
  const datos = leerDataUrl(valor);
  if (!datos) return valor;
  const hash = createHash('sha1')
    .update(datos.base64)
    .digest('hex')
    .slice(0, 12);
  const nombre = datos.nombre ?? 'adjunto';
  return `[archivo ${nombre} · ${datos.mime} · ${formatearTamano(datos.tamano)} · ${hash}]`;
}
