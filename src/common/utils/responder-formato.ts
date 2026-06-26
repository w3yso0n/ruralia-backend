import { Response } from 'express';
import * as csv from 'fast-csv';

export function responderFormato<T extends Record<string, unknown>>(
  res: Response,
  datos: T | T[],
  formato: string,
  nombreArchivo: string,
): void | T | T[] {
  if (formato === 'csv') {
    const filas = Array.isArray(datos) ? datos : [datos];
    const aplanadas = filas.map((fila) => aplanarObjeto(fila));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreArchivo}.csv"`,
    );

    const stream = csv.format({ headers: true });
    stream.pipe(res);
    aplanadas.forEach((fila) => stream.write(fila));
    stream.end();
    return;
  }

  return datos;
}

function aplanarObjeto(
  obj: Record<string, unknown>,
  prefijo = '',
): Record<string, string | number | boolean | null> {
  const resultado: Record<string, string | number | boolean | null> = {};

  for (const [clave, valor] of Object.entries(obj)) {
    const claveCompleta = prefijo ? `${prefijo}.${clave}` : clave;

    if (valor === null || valor === undefined) {
      resultado[claveCompleta] = null;
    } else if (Array.isArray(valor)) {
      resultado[claveCompleta] = JSON.stringify(valor);
    } else if (typeof valor === 'object' && !(valor instanceof Date)) {
      Object.assign(
        resultado,
        aplanarObjeto(valor as Record<string, unknown>, claveCompleta),
      );
    } else if (valor instanceof Date) {
      resultado[claveCompleta] = valor.toISOString();
    } else if (
      typeof valor === 'string' ||
      typeof valor === 'number' ||
      typeof valor === 'boolean'
    ) {
      resultado[claveCompleta] = valor;
    } else {
      resultado[claveCompleta] = String(valor);
    }
  }

  return resultado;
}
