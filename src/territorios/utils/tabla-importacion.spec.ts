import { leerCsv, leerTabla } from './tabla-importacion';

describe('leerCsv', () => {
  it('detecta punto y coma y respeta comillas', () => {
    expect(leerCsv('a;b;c\n1;"x; y";"di ""hola"""\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x; y', 'di "hola"'],
    ]);
  });

  it('usa coma cuando predomina y quita el BOM', () => {
    expect(leerCsv('﻿codigo,nombre\r\n01,Uno')).toEqual([
      ['codigo', 'nombre'],
      ['01', 'Uno'],
    ]);
  });
});

describe('leerTabla', () => {
  it('encuentra la fila de títulos y omite filas vacías', async () => {
    const csv = 'Listado oficial\n\nCOD;NOMBRE VEREDA\nP1;Uno\n;\nP2;Dos\n';
    const tabla = await leerTabla(Buffer.from(csv, 'utf8'), 'veredas.csv');
    expect(tabla.filaEncabezado).toBe(3);
    expect(tabla.encabezados).toEqual(['COD', 'NOMBRE VEREDA']);
    expect(tabla.filas.map((f) => f.celdas)).toEqual([
      ['P1', 'Uno'],
      ['P2', 'Dos'],
    ]);
  });
});
