import ExcelJS from 'exceljs';
import {
  colLetter,
  etiquetaMesCorto,
} from './generar-excel-seguimiento';

/** Colores alineados al Excel mensual de referencia. */
const COL_A_BG = 'FFF0F0F0';
const HEADER_BG = 'FFA0A0A0';
const DIA_LABEL_BG = 'FFFFFFFF';
const DIA_ACTUAL_BG = 'FF00B050';
const GRUPO_IMPAR_BG = 'FFFFF2CC';
const GRUPO_PAR_BG = 'FFDDEBF7';
const BORDE_TABLA = 'FF0000D0';

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

export interface FilaSeguimientoDiario {
  subactividadNombre: string;
  procesoNombre: string;
  metaCantidad: number;
  unidadMedida: string;
  /** Plan del mes (meta_periodos). No hay plan por día en el modelo. */
  planMes: number | null;
  /** Ejecutado por día del mes (índice 0 = día 1). */
  ejecPorDia: Array<number | null>;
}

export interface DatosExcelSeguimientoDiario {
  proyectoNombre: string;
  anio: number;
  mes: number; // 1–12
  /** Cantidad de días del mes (28–31). */
  diasEnMes: number;
  /** Día del mes actual (1–31) si anio/mes coinciden con hoy; si no, -1. */
  diaActual: number;
  filas: FilaSeguimientoDiario[];
}

function bordeDelgado(color = BORDE_TABLA): Partial<ExcelJS.Borders> {
  const lado: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: color },
  };
  return { top: lado, left: lado, bottom: lado, right: lado };
}

function estiloCentrado(bold = false): Partial<ExcelJS.Style> {
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

function fillSolid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

export function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

/**
 * Excel diario de un mes: columnas = días 1..N.
 * Plan: sin desglose diario (el modelo solo tiene plan mensual) → días vacíos, TOTAL = plan del mes.
 * Ejec: suma real de jornadas por día × meta.
 */
export async function generarExcelSeguimientoDiario(
  datos: DatosExcelSeguimientoDiario,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ruralia';
  wb.created = new Date();

  const etiquetaMes = etiquetaMesCorto(datos.anio, datos.mes);
  const ws = wb.addWorksheet(`Diario ${etiquetaMes}`, {
    views: [{ state: 'frozen', xSplit: 5, ySplit: 3 }],
  });

  const numDias = datos.diasEnMes;
  const colPrimeraDia = 6; // F
  const colUltimoDia = colPrimeraDia + numDias - 1;
  const colTotal = colUltimoDia + 1;
  const colAvance = colUltimoDia + 2;
  const ultimaCol = colAvance;

  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 42;
  ws.getColumn(3).width = 28;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 16;
  for (let c = colPrimeraDia; c <= colUltimoDia; c++) {
    ws.getColumn(c).width = 5.5;
  }
  ws.getColumn(colTotal).width = 10;
  ws.getColumn(colAvance).width = 12;

  ws.getCell('A1').value =
    `${datos.proyectoNombre} — avance diario ${etiquetaMes}`;
  ws.getCell('A1').font = { bold: true, size: 12, name: 'Calibri' };

  // ——— Encabezados filas 2–3 ———
  ws.mergeCells('B2:B3');
  ws.mergeCells('C2:C3');
  ws.mergeCells('D2:D3');
  ws.mergeCells('E2:E3');

  const headersFijos: Array<[string, string]> = [
    ['B2', 'SUB ACTIVIDAD\n(Subactividades MGA)'],
    ['C2', 'PROCESO'],
    ['D2', 'META'],
    ['E2', 'UNIDAD MEDIDA META'],
  ];
  for (const [ref, texto] of headersFijos) {
    const cell = ws.getCell(ref);
    cell.value = texto;
    cell.style = {
      ...estiloCentrado(true),
      fill: fillSolid(HEADER_BG),
    };
  }
  for (const ref of ['B3', 'C3', 'D3', 'E3'] as const) {
    ws.getCell(ref).fill = fillSolid(HEADER_BG);
    ws.getCell(ref).border = bordeDelgado();
  }

  for (const row of [2, 3]) {
    const a = ws.getCell(row, 1);
    a.fill = fillSolid(COL_A_BG);
    a.border = bordeDelgado();
  }

  for (let dia = 1; dia <= numDias; dia++) {
    const col = colPrimeraDia + dia - 1;
    const numCell = ws.getCell(2, col);
    numCell.value = dia;
    numCell.style = {
      ...estiloCentrado(true),
      fill: fillSolid(HEADER_BG),
    };

    const fecha = new Date(datos.anio, datos.mes - 1, dia);
    const labelCell = ws.getCell(3, col);
    labelCell.value = DIAS_SEMANA[fecha.getDay()];
    const esHoy = dia === datos.diaActual;
    labelCell.style = {
      ...estiloCentrado(true),
      fill: fillSolid(esHoy ? DIA_ACTUAL_BG : DIA_LABEL_BG),
    };
  }

  ws.mergeCells(2, colTotal, 3, colTotal);
  const totalHeader = ws.getCell(2, colTotal);
  totalHeader.value = 'TOTAL';
  totalHeader.style = {
    ...estiloCentrado(true),
    fill: fillSolid(HEADER_BG),
  };
  ws.getCell(3, colTotal).fill = fillSolid(HEADER_BG);
  ws.getCell(3, colTotal).border = bordeDelgado();

  ws.mergeCells(2, colAvance, 3, colAvance);
  const avanceHeader = ws.getCell(2, colAvance);
  avanceHeader.value = '% DE AVANCE';
  avanceHeader.style = {
    ...estiloCentrado(true),
    fill: fillSolid(HEADER_BG),
  };
  ws.getCell(3, colAvance).fill = fillSolid(HEADER_BG);
  ws.getCell(3, colAvance).border = bordeDelgado();

  type Bloque = {
    subactividadNombre: string;
    procesos: FilaSeguimientoDiario[];
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

  let filaActual = 4;
  const letraInicio = colLetter(colPrimeraDia);
  const letraFin = colLetter(colUltimoDia);
  const letraTotal = colLetter(colTotal);

  bloques.forEach((bloque, indiceBloque) => {
    const banda = indiceBloque % 2 === 0 ? GRUPO_IMPAR_BG : GRUPO_PAR_BG;
    const filaInicioSub = filaActual;
    const filasSub = bloque.procesos.length * 2;
    const filaFinSub = filaInicioSub + filasSub - 1;

    for (const proceso of bloque.procesos) {
      const filaPlan = filaActual;
      const filaEjec = filaActual + 1;

      for (const [row, etiqueta] of [
        [filaPlan, 'Plan'],
        [filaEjec, 'Ejec'],
      ] as const) {
        const cell = ws.getCell(row, 1);
        cell.value = etiqueta;
        cell.style = {
          ...estiloCentrado(false),
          fill: fillSolid(COL_A_BG),
        };
      }

      ws.mergeCells(filaPlan, 3, filaEjec, 3);
      ws.mergeCells(filaPlan, 4, filaEjec, 4);
      ws.mergeCells(filaPlan, 5, filaEjec, 5);

      const cellC = ws.getCell(filaPlan, 3);
      cellC.value = proceso.procesoNombre;
      cellC.style = { ...estiloCentrado(false), fill: fillSolid(banda) };

      const cellD = ws.getCell(filaPlan, 4);
      cellD.value = Number(proceso.metaCantidad);
      cellD.style = {
        ...estiloCentrado(false),
        fill: fillSolid(banda),
        numFmt: '0.##',
      };

      const cellE = ws.getCell(filaPlan, 5);
      cellE.value = proceso.unidadMedida;
      cellE.style = { ...estiloCentrado(false), fill: fillSolid(banda) };

      for (const col of [3, 4, 5]) {
        const bajo = ws.getCell(filaEjec, col);
        bajo.fill = fillSolid(banda);
        bajo.border = bordeDelgado();
      }

      // Plan: sin desglose diario → celdas vacías; TOTAL = plan del mes
      for (let dia = 1; dia <= numDias; dia++) {
        const cell = ws.getCell(filaPlan, colPrimeraDia + dia - 1);
        cell.style = { ...estiloCentrado(false), fill: fillSolid(banda) };
      }
      const totalPlan = ws.getCell(filaPlan, colTotal);
      if (proceso.planMes != null) {
        totalPlan.value = Number(proceso.planMes);
      } else {
        totalPlan.value = 'n/a';
      }
      totalPlan.style = {
        ...estiloCentrado(false),
        fill: fillSolid(banda),
        ...(proceso.planMes != null ? { numFmt: '0.##' } : {}),
      };
      const avancePlan = ws.getCell(filaPlan, colAvance);
      avancePlan.value = {
        formula: `IF(D${filaPlan}=0,0,${letraTotal}${filaPlan}/D${filaPlan})`,
      };
      avancePlan.style = {
        ...estiloCentrado(false),
        fill: fillSolid(banda),
        numFmt: '0.0%',
      };

      // Ejec: valores por día
      for (let dia = 1; dia <= numDias; dia++) {
        const cell = ws.getCell(filaEjec, colPrimeraDia + dia - 1);
        const v = proceso.ejecPorDia[dia - 1];
        if (v != null && v !== 0) {
          cell.value = Number(v);
        } else if (v === 0) {
          cell.value = 0;
        }
        cell.style = {
          ...estiloCentrado(false),
          fill: fillSolid(banda),
          numFmt: '0.##',
        };
      }
      const totalEjec = ws.getCell(filaEjec, colTotal);
      totalEjec.value = {
        formula: `SUM(${letraInicio}${filaEjec}:${letraFin}${filaEjec})`,
      };
      totalEjec.style = {
        ...estiloCentrado(false),
        fill: fillSolid(banda),
        numFmt: '0.##',
      };
      const avanceEjec = ws.getCell(filaEjec, colAvance);
      avanceEjec.value = {
        formula: `IF(D${filaPlan}=0,0,${letraTotal}${filaEjec}/D${filaPlan})`,
      };
      avanceEjec.style = {
        ...estiloCentrado(false),
        fill: fillSolid(banda),
        numFmt: '0.0%',
      };

      filaActual += 2;
    }

    if (filasSub >= 1) {
      if (filasSub > 1) {
        ws.mergeCells(filaInicioSub, 2, filaFinSub, 2);
      }
      const cellB = ws.getCell(filaInicioSub, 2);
      cellB.value = bloque.subactividadNombre;
      cellB.style = { ...estiloCentrado(false), fill: fillSolid(banda) };
      for (let r = filaInicioSub; r <= filaFinSub; r++) {
        const c = ws.getCell(r, 2);
        c.fill = fillSolid(banda);
        c.border = bordeDelgado();
      }
    }
  });

  const ultimaFilaDatos = Math.max(filaActual - 1, 3);
  ws.autoFilter = {
    from: { row: 2, column: colPrimeraDia },
    to: { row: ultimaFilaDatos, column: ultimaCol },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
