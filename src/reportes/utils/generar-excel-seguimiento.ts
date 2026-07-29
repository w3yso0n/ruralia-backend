import ExcelJS from 'exceljs';

/** Colores del archivo de referencia (ARGB para ExcelJS). */
const COL_A_BG = 'FFF0F0F0';
const HEADER_BG = 'FFA0A0A0';
const MES_LABEL_BG = 'FFFFFFFF';
const MES_ACTUAL_BG = 'FF00B050';
const GRUPO_IMPAR_BG = 'FFFFF2CC';
const GRUPO_PAR_BG = 'FFDDEBF7';
const BORDE_TABLA = 'FF0000D0';

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

export interface MesColumna {
  anio: number;
  mes: number; // 1–12
}

export interface FilaProcesoSeguimiento {
  subactividadNombre: string;
  procesoNombre: string;
  metaCantidad: number;
  unidadMedida: string;
  /** Valores absolutos planeados por mes (mismo orden que `meses`). */
  planPorMes: Array<number | null>;
  /** Valores absolutos ejecutados por mes (mismo orden que `meses`). */
  ejecPorMes: Array<number | null>;
}

export interface DatosExcelSeguimiento {
  proyectoNombre: string;
  meses: MesColumna[];
  /** Índice 0-based del mes actual dentro de `meses`, o -1 si no está en el rango. */
  indiceMesActual: number;
  filas: FilaProcesoSeguimiento[];
}

export function etiquetaMesCorto(anio: number, mes: number): string {
  const yy = String(anio % 100).padStart(2, '0');
  return `${MESES_CORTOS[mes - 1]}-${yy}`;
}

export function colLetter(col: number): string {
  let n = col;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function bordeDelgado(color = BORDE_TABLA): Partial<ExcelJS.Borders> {
  const lado: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: color },
  };
  return { top: lado, left: lado, bottom: lado, right: lado };
}

function estiloCentrado(
  bold = false,
): Partial<ExcelJS.Style> {
  return {
    font: { bold, name: 'Calibri', size: 10 },
    alignment: {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    },
    border: bordeDelgado(),
  };
}

/**
 * Genera el Excel de seguimiento Plan/Ejec del proyecto.
 * TOTAL y % DE AVANCE van como fórmulas reales de Excel.
 */
export async function generarExcelSeguimiento(
  datos: DatosExcelSeguimiento,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ruralia';
  wb.created = new Date();

  const ws = wb.addWorksheet('Seguimiento', {
    views: [{ state: 'frozen', xSplit: 5, ySplit: 3 }],
  });

  const numMeses = datos.meses.length;
  const colPrimeraMes = 6; // F
  const colUltimoMes = colPrimeraMes + Math.max(numMeses, 1) - 1;
  const colTotal = colUltimoMes + 1;
  const colAvance = colUltimoMes + 2;
  const ultimaCol = colAvance;

  // Anchos
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 42;
  ws.getColumn(3).width = 28;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 16;
  for (let c = colPrimeraMes; c <= colUltimoMes; c++) {
    ws.getColumn(c).width = 9;
  }
  ws.getColumn(colTotal).width = 10;
  ws.getColumn(colAvance).width = 12;

  // ——— Encabezados filas 2–3 ———
  ws.mergeCells('B2:B3');
  ws.mergeCells('C2:C3');
  ws.mergeCells('D2:D3');
  ws.mergeCells('E2:E3');

  const b2 = ws.getCell('B2');
  b2.value = 'SUB ACTIVIDAD\n(Subactividades MGA)';
  Object.assign(b2, { style: { ...estiloCentrado(true), fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } } } });

  const c2 = ws.getCell('C2');
  c2.value = 'PROCESO';
  Object.assign(c2, { style: { ...estiloCentrado(true), fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } } } });

  const d2 = ws.getCell('D2');
  d2.value = 'META';
  Object.assign(d2, { style: { ...estiloCentrado(true), fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } } } });

  const e2 = ws.getCell('E2');
  e2.value = 'UNIDAD MEDIDA META';
  Object.assign(e2, {
    style: {
      ...estiloCentrado(true),
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_BG },
      },
    },
  });

  // Reaplicar fill/borde en celdas fusionadas inferiores
  for (const ref of ['B3', 'C3', 'D3', 'E3'] as const) {
    const cell = ws.getCell(ref);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_BG },
    };
    cell.border = bordeDelgado();
  }

  // A2 / A3 vacíos con estilo
  for (const row of [2, 3]) {
    const a = ws.getCell(row, 1);
    a.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COL_A_BG },
    };
    a.border = bordeDelgado();
  }

  if (numMeses === 0) {
    // Sin meses: solo TOTAL y %
    const t2 = ws.getCell(2, colTotal);
    t2.value = 'TOTAL';
    t2.style = {
      ...estiloCentrado(true),
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } },
    };
    ws.mergeCells(2, colTotal, 3, colTotal);

    const p2 = ws.getCell(2, colAvance);
    p2.value = '% DE AVANCE';
    p2.style = {
      ...estiloCentrado(true),
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } },
    };
    ws.mergeCells(2, colAvance, 3, colAvance);
  } else {
    datos.meses.forEach((m, i) => {
      const col = colPrimeraMes + i;
      const numCell = ws.getCell(2, col);
      numCell.value = i + 1;
      numCell.style = {
        ...estiloCentrado(true),
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: HEADER_BG },
        },
      };

      const labelCell = ws.getCell(3, col);
      labelCell.value = etiquetaMesCorto(m.anio, m.mes);
      const esActual = i === datos.indiceMesActual;
      labelCell.style = {
        ...estiloCentrado(true),
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: esActual ? MES_ACTUAL_BG : MES_LABEL_BG },
        },
      };
    });

    // TOTAL y % DE AVANCE (combinados verticalmente como B–E)
    ws.mergeCells(2, colTotal, 3, colTotal);
    const totalHeader = ws.getCell(2, colTotal);
    totalHeader.value = 'TOTAL';
    totalHeader.style = {
      ...estiloCentrado(true),
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } },
    };
    ws.getCell(3, colTotal).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_BG },
    };
    ws.getCell(3, colTotal).border = bordeDelgado();

    ws.mergeCells(2, colAvance, 3, colAvance);
    const avanceHeader = ws.getCell(2, colAvance);
    avanceHeader.value = '% DE AVANCE';
    avanceHeader.style = {
      ...estiloCentrado(true),
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } },
    };
    ws.getCell(3, colAvance).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_BG },
    };
    ws.getCell(3, colAvance).border = bordeDelgado();
  }

  // Autofiltro en bloque de encabezado F… (números + etiquetas + TOTAL + %)
  const primeraFilaDatos = 4;
  let filaActual = primeraFilaDatos;

  // Agrupar filas por subactividad para merges y bandas
  type Bloque = {
    subactividadNombre: string;
    procesos: FilaProcesoSeguimiento[];
  };
  const bloques: Bloque[] = [];
  for (const fila of datos.filas) {
    const ultimo = bloques[bloques.length - 1];
    if (ultimo && ultimo.subactividadNombre === fila.subactividadNombre) {
      ultimo.procesos.push(fila);
    } else {
      bloques.push({
        subactividadNombre: fila.subactividadNombre,
        procesos: [fila],
      });
    }
  }

  bloques.forEach((bloque, indiceBloque) => {
    const banda =
      indiceBloque % 2 === 0 ? GRUPO_IMPAR_BG : GRUPO_PAR_BG;
    const filaInicioSub = filaActual;
    const filasSub = bloque.procesos.length * 2;
    const filaFinSub = filaInicioSub + filasSub - 1;

    for (const proceso of bloque.procesos) {
      const filaPlan = filaActual;
      const filaEjec = filaActual + 1;

      // Columna A
      for (const [row, etiqueta] of [
        [filaPlan, 'Plan'],
        [filaEjec, 'Ejec'],
      ] as const) {
        const cell = ws.getCell(row, 1);
        cell.value = etiqueta;
        cell.style = {
          ...estiloCentrado(false),
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COL_A_BG },
          },
        };
      }

      // C, D, E combinados por par
      ws.mergeCells(filaPlan, 3, filaEjec, 3);
      ws.mergeCells(filaPlan, 4, filaEjec, 4);
      ws.mergeCells(filaPlan, 5, filaEjec, 5);

      const cellC = ws.getCell(filaPlan, 3);
      cellC.value = proceso.procesoNombre;
      cellC.style = {
        ...estiloCentrado(false),
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: banda },
        },
      };

      const cellD = ws.getCell(filaPlan, 4);
      cellD.value = Number(proceso.metaCantidad);
      cellD.numFmt = '0.##';
      cellD.style = {
        ...estiloCentrado(false),
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: banda },
        },
        numFmt: '0.##',
      };

      const cellE = ws.getCell(filaPlan, 5);
      cellE.value = proceso.unidadMedida;
      cellE.style = {
        ...estiloCentrado(false),
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: banda },
        },
      };

      // Pintar celdas inferiores del merge
      for (const col of [3, 4, 5]) {
        const bajo = ws.getCell(filaEjec, col);
        bajo.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: banda },
        };
        bajo.border = bordeDelgado();
      }

      const letraInicioMes = colLetter(colPrimeraMes);
      const letraFinMes = colLetter(colUltimoMes);
      const letraTotal = colLetter(colTotal);

      const pintarFilaMeses = (
        row: number,
        valores: Array<number | null>,
        tipo: 'plan' | 'ejec',
      ) => {
        for (let i = 0; i < numMeses; i++) {
          const cell = ws.getCell(row, colPrimeraMes + i);
          const v = valores[i];
          const esNumerico = v != null || tipo === 'ejec';
          if (v != null) {
            cell.value = Number(v);
          } else if (tipo === 'plan') {
            // Sin cantidad planeada para el mes
            cell.value = 'n/a';
          } else {
            // Sin resultados reportados → 0
            cell.value = 0;
          }
          cell.style = {
            ...estiloCentrado(false),
            fill: {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: banda },
            },
            ...(esNumerico ? { numFmt: '0.##' } : {}),
          };
        }

        // TOTAL = SUM(...)
        const totalCell = ws.getCell(row, colTotal);
        if (numMeses > 0) {
          totalCell.value = {
            formula: `SUM(${letraInicioMes}${row}:${letraFinMes}${row})`,
          };
        } else {
          totalCell.value = 0;
        }
        totalCell.numFmt = '0.##';
        totalCell.style = {
          ...estiloCentrado(false),
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: banda },
          },
          numFmt: '0.##',
        };

        // % DE AVANCE = TOTAL / META (D de la fila Plan del par)
        const avanceCell = ws.getCell(row, colAvance);
        avanceCell.value = {
          formula: `IF(D${filaPlan}=0,0,${letraTotal}${row}/D${filaPlan})`,
        };
        avanceCell.numFmt = '0.0%';
        avanceCell.style = {
          ...estiloCentrado(false),
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: banda },
          },
          numFmt: '0.0%',
        };
      };

      pintarFilaMeses(filaPlan, proceso.planPorMes, 'plan');
      pintarFilaMeses(filaEjec, proceso.ejecPorMes, 'ejec');

      filaActual += 2;
    }

    // Columna B: merge de toda la subactividad
    if (filasSub >= 1) {
      if (filasSub > 1) {
        ws.mergeCells(filaInicioSub, 2, filaFinSub, 2);
      }
      const cellB = ws.getCell(filaInicioSub, 2);
      cellB.value = bloque.subactividadNombre;
      cellB.style = {
        ...estiloCentrado(false),
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: banda },
        },
      };
      for (let r = filaInicioSub; r <= filaFinSub; r++) {
        const c = ws.getCell(r, 2);
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: banda },
        };
        c.border = bordeDelgado();
      }
    }
  });

  const ultimaFilaDatos = Math.max(filaActual - 1, 3);

  // Autofiltro: columnas F en adelante sobre el bloque de encabezado + datos
  ws.autoFilter = {
    from: { row: 2, column: colPrimeraMes },
    to: { row: ultimaFilaDatos, column: ultimaCol },
  };

  // Título en fila 1 (opcional, fuera de la tabla)
  ws.getCell('A1').value = datos.proyectoNombre;
  ws.getCell('A1').font = { bold: true, size: 12, name: 'Calibri' };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Lista meses inclusive entre dos fechas (día 1 de cada mes). */
export function enumerarMeses(
  inicio: { anio: number; mes: number },
  fin: { anio: number; mes: number },
): MesColumna[] {
  const out: MesColumna[] = [];
  let y = inicio.anio;
  let m = inicio.mes;
  while (y < fin.anio || (y === fin.anio && m <= fin.mes)) {
    out.push({ anio: y, mes: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function mesDesdeDate(d: Date): MesColumna {
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

export function compararMes(a: MesColumna, b: MesColumna): number {
  return a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes;
}
