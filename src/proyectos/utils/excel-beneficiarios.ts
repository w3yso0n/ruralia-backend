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
  return String(valor).trim();
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

export async function parsearExcelBeneficiarios(
  buffer: Buffer,
): Promise<FilaExcelBeneficiario[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const hoja = wb.worksheets[0];
  if (!hoja) return [];

  const encabezados: string[] = [];
  hoja.getRow(1).eachCell({ includeEmpty: true }, (celda, col) => {
    encabezados[col] = normalizarEncabezado(celda.value);
  });

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
    if (numero === 1) return;
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
  const hoja = wb.addWorksheet('Beneficiarios');
  hoja.columns = [
    { header: 'nombres', width: 24 },
    { header: 'apellidos', width: 24 },
    { header: 'identificador', width: 18 },
    { header: 'tipo_documento', width: 16 },
    { header: 'telefono', width: 16 },
    { header: 'correo', width: 28 },
  ];
  hoja.getRow(1).font = { bold: true };
  hoja.addRow(['María', 'López García', '1020304050', 'CC', '3001234567', '']);
  hoja.addRow(['Juan Carlos', 'Pérez', '1122334455', 'CC', '', '']);
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
