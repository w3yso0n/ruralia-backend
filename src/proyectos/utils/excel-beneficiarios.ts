import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import ExcelJS from 'exceljs';
import { TipoDocumento } from '../../beneficiarios/enums/tipo-documento.enum';

export interface FilaExcelBeneficiario {
  fila: number;
  nombres: string;
  apellidos: string;
  identificador: string;
  tipoDocumento: TipoDocumento;
  telefono?: string;
  correo?: string;
}

const ALIAS_NOMBRE = ['nombre', 'nombres', 'nombre completo', 'nombre_completo'];
const ALIAS_APELLIDOS = ['apellidos', 'apellido'];
const ALIAS_ID = [
  'identificador',
  'id',
  'documento',
  'numero_documento',
  'numerodocumento',
  'cedula',
  'cédula',
  'cc',
  'nro documento',
  'nro_documento',
];
const ALIAS_TIPO = ['tipo_documento', 'tipo documento', 'tipodocumento', 'tipo id'];
const ALIAS_TELEFONO = ['telefono', 'teléfono', 'celular', 'movil', 'móvil'];
const ALIAS_CORREO = ['correo', 'email', 'correo electronico', 'correo electrónico'];

function normalizarEncabezado(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function celdaTexto(valor: unknown): string {
  if (valor == null) return '';
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor).trim();
  }
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    const objeto = valor as {
      text?: unknown;
      hyperlink?: unknown;
      result?: unknown;
      richText?: Array<{ text?: string }>;
    };
    if (Array.isArray(objeto.richText)) {
      return objeto.richText.map((parte) => parte.text ?? '').join('').trim();
    }
    if (typeof objeto.text === 'string' || typeof objeto.text === 'number') {
      return String(objeto.text).trim();
    }
    if (typeof objeto.result === 'string' || typeof objeto.result === 'number') {
      return String(objeto.result).trim();
    }
    if (typeof objeto.hyperlink === 'string') {
      return objeto.hyperlink.replace(/^mailto:/i, '').trim();
    }
  }
  return '';
}

export function normalizarIdentificador(valor: string): string {
  return valor.replace(/[\s.\-]/g, '').toUpperCase();
}

export function partirNombreCompleto(nombre: string): {
  nombres: string;
  apellidos: string;
} {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nombres: '', apellidos: '' };
  if (partes.length === 1) return { nombres: partes[0], apellidos: partes[0] };
  if (partes.length === 2) return { nombres: partes[0], apellidos: partes[1] };
  return {
    nombres: partes.slice(0, -2).join(' '),
    apellidos: partes.slice(-2).join(' '),
  };
}

function tipoDesdeTexto(valor: string): TipoDocumento {
  const clave = normalizarEncabezado(valor).replace(/\s+/g, '');
  if (clave === 'ce' || clave.includes('extranjer')) return TipoDocumento.CE;
  if (clave === 'ti' || clave.includes('tarjeta')) return TipoDocumento.TI;
  if (clave.includes('pasaporte') || clave === 'pa' || clave === 'pp') {
    return TipoDocumento.PASAPORTE;
  }
  return TipoDocumento.CC;
}

function indiceColumna(
  encabezados: string[],
  alias: string[],
): number {
  return encabezados.findIndex((h) => alias.includes(h));
}

function leerEncabezados(row: ExcelJS.Row): string[] {
  const encabezados: string[] = [];
  row.eachCell({ includeEmpty: true }, (celda, col) => {
    encabezados[col] = normalizarEncabezado(celda.value);
  });
  return encabezados;
}

function buscarFilaEncabezado(hoja: ExcelJS.Worksheet): number {
  let encontrada = 0;
  const tope = Math.min(hoja.rowCount, 30);
  for (let numero = 1; numero <= tope; numero += 1) {
    const encabezados = leerEncabezados(hoja.getRow(numero));
    if (
      indiceColumna(encabezados, ALIAS_NOMBRE) >= 0 &&
      indiceColumna(encabezados, ALIAS_ID) >= 0
    ) {
      encontrada = numero;
      break;
    }
  }
  return encontrada;
}

function cargarLogoRuralia(): Buffer | null {
  const candidatos = [
    join(process.cwd(), 'assets', 'logo-ruralia.png'),
    join(process.cwd(), 'ruralia-backend', 'assets', 'logo-ruralia.png'),
    join(__dirname, '../../../assets/logo-ruralia.png'),
  ];
  for (const ruta of candidatos) {
    if (existsSync(ruta)) return readFileSync(ruta);
  }
  return null;
}

const NAVY = 'FF121C2D';
const TEAL = 'FF42827A';
const TEAL_SOFT = 'FFEEF3F2';
const TEAL_TEXTO = 'FF2D524D';
const BLANCO = 'FFFFFFFF';
const ZINC = 'FFD4E4E1';

export async function parsearExcelBeneficiarios(
  buffer: Buffer,
): Promise<FilaExcelBeneficiario[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const hoja = wb.worksheets[0];
  if (!hoja) return [];

  const filaEncabezado = buscarFilaEncabezado(hoja);
  if (filaEncabezado < 1) {
    throw new Error(
      'El Excel debe tener columnas de nombre (o nombres) e identificador/documento.',
    );
  }

  const encabezados = leerEncabezados(hoja.getRow(filaEncabezado));

  const colNombre = indiceColumna(encabezados, ALIAS_NOMBRE);
  const colApellidos = indiceColumna(encabezados, ALIAS_APELLIDOS);
  const colId = indiceColumna(encabezados, ALIAS_ID);
  const colTipo = indiceColumna(encabezados, ALIAS_TIPO);
  const colTel = indiceColumna(encabezados, ALIAS_TELEFONO);
  const colCorreo = indiceColumna(encabezados, ALIAS_CORREO);

  if (colId < 0 || colNombre < 0) {
    throw new Error(
      'El Excel debe tener columnas de nombre (o nombres) e identificador/documento.',
    );
  }

  const filas: FilaExcelBeneficiario[] = [];
  hoja.eachRow((row, numero) => {
    if (numero <= filaEncabezado) return;
    const identificador = normalizarIdentificador(
      celdaTexto(row.getCell(colId).value),
    );
    const nombreCrudo = celdaTexto(row.getCell(colNombre).value);
    const apellidosCol =
      colApellidos > 0 ? celdaTexto(row.getCell(colApellidos).value) : '';
    if (!identificador && !nombreCrudo) return;

    const partido = partirNombreCompleto(nombreCrudo);
    filas.push({
      fila: numero,
      identificador,
      nombres: partido.nombres,
      apellidos: apellidosCol || partido.apellidos,
      tipoDocumento:
        colTipo > 0
          ? tipoDesdeTexto(celdaTexto(row.getCell(colTipo).value))
          : TipoDocumento.CC,
      telefono: colTel > 0 ? celdaTexto(row.getCell(colTel).value) || undefined : undefined,
      correo:
        colCorreo > 0 ? celdaTexto(row.getCell(colCorreo).value) || undefined : undefined,
    });
  });

  return filas;
}

export async function generarPlantillaExcelBeneficiarios(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ruralia';
  wb.created = new Date();

  const hoja = wb.addWorksheet('Beneficiarios', {
    views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
    properties: { tabColor: { argb: TEAL } },
  });

  const columnas = [
    { key: 'nombres', width: 26, titulo: 'nombres' },
    { key: 'apellidos', width: 26, titulo: 'apellidos' },
    { key: 'identificador', width: 20, titulo: 'identificador' },
    { key: 'tipo_documento', width: 18, titulo: 'tipo_documento' },
    { key: 'telefono', width: 18, titulo: 'telefono' },
    { key: 'correo', width: 32, titulo: 'correo' },
  ];
  columnas.forEach((columna, indice) => {
    hoja.getColumn(indice + 1).width = columna.width;
  });
  hoja.getColumn(1).width = 18;

  hoja.getRow(1).height = 22;
  hoja.getRow(2).height = 28;
  hoja.getRow(3).height = 22;
  hoja.getRow(4).height = 18;
  for (let fila = 1; fila <= 4; fila += 1) {
    for (let col = 1; col <= 6; col += 1) {
      const celda = hoja.getCell(fila, col);
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: NAVY },
      };
    }
  }

  hoja.mergeCells('B2:F2');
  hoja.mergeCells('B3:F3');
  const titulo = hoja.getCell('B2');
  titulo.value = 'Ruralia';
  titulo.font = { name: 'Calibri', size: 20, bold: true, color: { argb: BLANCO } };
  titulo.alignment = { vertical: 'middle', horizontal: 'left' };

  const subtitulo = hoja.getCell('B3');
  subtitulo.value = 'Plantilla de carga de beneficiarios';
  subtitulo.font = { name: 'Calibri', size: 12, color: { argb: 'FFD4E4E1' } };
  subtitulo.alignment = { vertical: 'middle', horizontal: 'left' };

  const logo = cargarLogoRuralia();
  if (logo) {
    const imagen = wb.addImage({
      buffer: logo as unknown as ExcelJS.Buffer,
      extension: 'png',
    });
    hoja.addImage(imagen, {
      tl: { col: 0.55, row: 0.18 },
      ext: { width: 96, height: 96 },
    });
  }

  hoja.getRow(5).height = 36;
  hoja.mergeCells('A5:F5');
  const ayuda = hoja.getCell('A5');
  ayuda.value =
    'Una fila por persona. Obligatorios: nombres e identificador. tipo_documento: CC, CE, TI o PASAPORTE. No cambies los títulos de la fila verde; escribe los datos desde la fila de abajo.';
  ayuda.font = { name: 'Calibri', size: 10, color: { argb: TEAL_TEXTO } };
  ayuda.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
  ayuda.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: TEAL_SOFT },
  };

  const encabezados = hoja.getRow(6);
  encabezados.height = 22;
  columnas.forEach((columna, indice) => {
    const celda = encabezados.getCell(indice + 1);
    celda.value = columna.titulo;
    celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BLANCO } };
    celda.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: TEAL },
    };
    celda.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  });

  hoja.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: 6 } };
  const validacionTipo: ExcelJS.DataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"CC,CE,TI,PASAPORTE"'],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Tipo de documento',
    error: 'Usa CC, CE, TI o PASAPORTE.',
  };
  for (let fila = 7; fila <= 200; fila += 1) {
    hoja.getCell(fila, 4).dataValidation = validacionTipo;
  }

  for (let fila = 7; fila <= 26; fila += 1) {
    const row = hoja.getRow(fila);
    row.height = 20;
    for (let col = 1; col <= 6; col += 1) {
      const celda = row.getCell(col);
      celda.font = { name: 'Calibri', size: 11, color: { argb: 'FF171717' } };
      celda.border = {
        bottom: { style: 'thin', color: { argb: ZINC } },
      };
      celda.alignment = { vertical: 'middle', indent: 1 };
    }
  }

  const guia = wb.addWorksheet('Como llenarla', {
    properties: { tabColor: { argb: NAVY } },
  });
  guia.getColumn(1).width = 28;
  guia.getColumn(2).width = 72;
  guia.mergeCells('A1:B1');
  guia.getRow(1).height = 28;
  const tituloGuia = guia.getCell('A1');
  tituloGuia.value = 'Ruralia · Cómo llenar la plantilla';
  tituloGuia.font = { name: 'Calibri', size: 16, bold: true, color: { argb: BLANCO } };
  tituloGuia.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: NAVY },
  };
  tituloGuia.alignment = { vertical: 'middle', indent: 1 };
  guia.getCell('B1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: NAVY },
  };

  const notas = [
    ['nombres', 'Obligatorio. Nombre o nombres de pila.'],
    ['apellidos', 'Apellidos. Si lo dejas vacío, se toma del nombre completo.'],
    ['identificador', 'Obligatorio. Cédula u otro documento, sin puntos ni espacios.'],
    ['tipo_documento', 'CC, CE, TI o PASAPORTE. Si lo omites, se asume CC.'],
    ['telefono', 'Opcional. Celular de contacto.'],
    ['correo', 'Opcional.'],
  ];
  notas.forEach((nota, indice) => {
    const fila = indice + 3;
    guia.getCell(fila, 1).value = nota[0];
    guia.getCell(fila, 1).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: TEAL_TEXTO },
    };
    guia.getCell(fila, 2).value = nota[1];
    guia.getCell(fila, 2).font = { name: 'Calibri', size: 11, color: { argb: 'FF171717' } };
    guia.getRow(fila).height = 22;
  });

  guia.getCell('A10').value =
    'El ejemplo de abajo es solo una guía. La carga lee la hoja Beneficiarios.';
  guia.getCell('A10').font = { name: 'Calibri', size: 11, italic: true, color: { argb: TEAL_TEXTO } };
  guia.mergeCells('A10:B10');

  const ejemploEncabezado = guia.getRow(12);
  ['nombres', 'apellidos', 'identificador', 'tipo_documento', 'telefono', 'correo'].forEach(
    (tituloCol, indice) => {
      const celda = ejemploEncabezado.getCell(indice + 1);
      celda.value = tituloCol;
      celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BLANCO } };
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: TEAL },
      };
    },
  );
  guia.getColumn(3).width = 18;
  guia.getColumn(4).width = 18;
  guia.getColumn(5).width = 16;
  guia.getColumn(6).width = 28;
  guia.addRow(['María', 'López García', '1020304050', 'CC', '3001234567', '']);
  guia.addRow(['Juan Carlos', 'Pérez', '1122334455', 'CC', '', '']);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
