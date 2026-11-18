import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

/**
 * Lectura genérica de una tabla desde Excel (.xlsx) o CSV para importadores
 * con mapeo de columnas. Devuelve todas las filas como texto; la primera fila
 * con al menos dos celdas de texto se toma como títulos (se puede cambiar
 * con `filaEncabezado`).
 */
export interface TablaLeida {
  filaEncabezado: number;
  encabezados: string[];
  /** Filas de datos (después de la de títulos), como texto recortado. */
  filas: Array<{ numero: number; celdas: string[] }>;
}

const FIRMA_XLS = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

function texto(valor: ExcelJS.CellValue): string {
  if (valor == null) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    if ('result' in valor && valor.result != null) return String(valor.result);
    if ('richText' in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((t) => t.text).join('');
    }
    if ('text' in valor && typeof valor.text === 'string') return valor.text;
    return '';
  }
  return String(valor);
}

/** CSV con separador `,` o `;` (el que más aparezca en la primera línea) y comillas dobles. */
export function leerCsv(contenido: string): string[][] {
  const limpio = contenido.replace(/^﻿/, '');
  // El separador se decide con las primeras líneas: la primera puede ser un título sin columnas.
  const muestra = limpio.split(/\r?\n/, 20).join('\n');
  const separador =
    (muestra.match(/;/g)?.length ?? 0) > (muestra.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        celda += c;
      }
      continue;
    }
    if (c === '"') entreComillas = true;
    else if (c === separador) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i += 1;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

async function leerMatriz(
  buffer: Buffer,
  nombre?: string,
): Promise<string[][]> {
  if (buffer.subarray(0, 4).equals(FIRMA_XLS)) {
    throw new BadRequestException(
      'El archivo es .xls (Excel 97-2003). Ábrelo en Excel y guárdalo como .xlsx o .csv.',
    );
  }
  const esXlsx =
    buffer.subarray(0, 4).equals(FIRMA_ZIP) || /\.xlsx$/i.test(nombre ?? '');
  if (!esXlsx) {
    return leerCsv(buffer.toString('utf8'));
  }
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException(
      'No se pudo leer el archivo. Guárdalo como Excel (.xlsx) o CSV e inténtalo de nuevo.',
    );
  }
  const hoja =
    libro.worksheets.find((h) => h.rowCount > 0) ?? libro.worksheets[0];
  if (!hoja) throw new BadRequestException('El archivo no tiene hojas');
  const matriz: string[][] = [];
  hoja.eachRow({ includeEmpty: true }, (row, numero) => {
    const celdas: string[] = [];
    row.eachCell({ includeEmpty: true }, (celda, columna) => {
      celdas[columna - 1] = texto(celda.value);
    });
    matriz[numero - 1] = Array.from(celdas, (v) => v ?? '');
  });
  return Array.from(matriz, (f) => f ?? []);
}

export async function leerTabla(
  buffer: Buffer,
  nombre?: string,
  filaEncabezado?: number,
): Promise<TablaLeida> {
  const matriz = (await leerMatriz(buffer, nombre)).map((f) =>
    f.map((v) => (v ?? '').trim()),
  );
  let encabezado = filaEncabezado ?? 0;
  if (!encabezado) {
    const indice = matriz.findIndex(
      (f) => f.filter((v) => v && !/^-?\d+([.,]\d+)?$/.test(v)).length >= 2,
    );
    encabezado = indice + 1;
  }
  if (encabezado < 1 || encabezado > matriz.length) {
    throw new BadRequestException(
      'No se encontró la fila de títulos: la primera fila con datos debe tener el nombre de cada columna.',
    );
  }
  const encabezados = matriz[encabezado - 1].map(
    (v, i) => v || `Columna ${i + 1}`,
  );
  const filas = matriz
    .slice(encabezado)
    .map((celdas, i) => ({ numero: encabezado + i + 1, celdas }))
    .filter((f) => f.celdas.some((v) => v));
  return { filaEncabezado: encabezado, encabezados, filas };
}

export function normalizarTitulo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
