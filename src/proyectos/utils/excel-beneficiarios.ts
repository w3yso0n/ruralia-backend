import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Beneficiario } from '../../beneficiarios/entities/beneficiario.entity';
import { Genero } from '../../beneficiarios/enums/genero.enum';
import { TipoDocumento } from '../../beneficiarios/enums/tipo-documento.enum';
import type {
  DatosAdicionales,
  TipoCampoBeneficiario,
  ValorDatoAdicional,
} from '../../beneficiarios/entities/campo-beneficiario.entity';

export interface FilaExcelBeneficiario {
  fila: number;
  nombres: string;
  apellidos: string;
  identificador: string;
  tipoDocumento: TipoDocumento;
  telefono?: string;
  correo?: string;
  primerNombre?: string | null;
  segundoNombre?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  genero?: Genero | null;
  edad?: number | null;
  municipio?: string | null;
  lineaProductiva?: string | null;
  nombreAsociacion?: string | null;
  /** AAAA-MM-DD. */
  fechaNacimiento?: string | null;
  /** Solo viene si el archivo tiene columna ESTADO. */
  estaActivo?: boolean;
  /** Columnas mapeadas como dato adicional. Las celdas vacías no vienen. */
  extras?: DatosAdicionales;
}

/** Campos del modelo `Beneficiario` a los que se puede asignar una columna. */
export type CampoModeloBeneficiario =
  | 'numeroDocumento'
  | 'tipoDocumento'
  | 'primerNombre'
  | 'segundoNombre'
  | 'primerApellido'
  | 'segundoApellido'
  | 'nombres'
  | 'apellidos'
  | 'telefono'
  | 'correo'
  | 'genero'
  | 'edad'
  | 'fechaNacimiento'
  | 'municipio'
  | 'lineaProductiva'
  | 'nombreAsociacion'
  | 'estado';

export type DestinoColumna =
  | { destino: 'modelo'; campo: CampoModeloBeneficiario }
  | {
      destino: 'extra';
      clave: string;
      etiqueta: string;
      tipo: TipoCampoBeneficiario;
    }
  | { destino: 'ignorar' };

export type ColumnaMapeo = DestinoColumna & { columna: number };

export interface MapeoColumnasBeneficiarios {
  filaEncabezado: number;
  columnas: ColumnaMapeo[];
}

export interface ColumnaExcelAnalizada {
  columna: number;
  letra: string;
  encabezado: string;
  muestras: string[];
  conDatos: number;
  tipoDetectado: TipoCampoBeneficiario;
  sugerencia: DestinoColumna;
}

export interface AnalisisExcelBeneficiarios {
  hoja: string;
  filaEncabezado: number;
  totalFilas: number;
  columnas: ColumnaExcelAnalizada[];
}

export interface CampoExtraLeido {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoBeneficiario;
  columnaOrigen: string;
}

/** Definición ya guardada, para reutilizar la misma clave en la siguiente carga. */
export interface CampoConocido {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoBeneficiario;
  columnaOrigen: string | null;
}

const MAX_CAMPOS_EXTRA = 100;
const MAX_COLUMNAS = 200;
const MAX_LARGO_VALOR = 1000;
const REGEX_CLAVE = /^[a-z][a-z0-9_]{0,59}$/;
const TIPOS_CAMPO: TipoCampoBeneficiario[] = ['texto', 'numero', 'fecha', 'booleano'];

const ALIAS_NOMBRE = ['nombre', 'nombres', 'nombre completo', 'nombre_completo'];
const ALIAS_APELLIDOS = ['apellidos', 'apellido'];
const ALIAS_PRIMER_NOMBRE = ['primer_nombre', 'primer nombre'];
const ALIAS_SEGUNDO_NOMBRE = ['segundo_nombre', 'segundo nombre'];
const ALIAS_PRIMER_APELLIDO = ['primer_apellido', 'primer apellido'];
const ALIAS_SEGUNDO_APELLIDO = ['segundo_apellido', 'segundo apellido'];
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
const ALIAS_TELEFONO = [
  'telefono',
  'teléfono',
  'celular',
  'movil',
  'móvil',
  'no_contacto',
  'no contacto',
  'nro_contacto',
  'numero_contacto',
];
const ALIAS_CORREO = ['correo', 'email', 'correo electronico', 'correo electrónico'];
const ALIAS_SEXO = ['sexo', 'genero', 'género'];
const ALIAS_EDAD = ['edad'];
const ALIAS_ASOCIACION = ['asociacion', 'asociación', 'nombre_asociacion'];
const ALIAS_MUNICIPIO = ['municipio'];
const ALIAS_LINEA = [
  'linea_productiva',
  'linea productiva',
  'línea_productiva',
  'línea productiva',
];
const ALIAS_ESTADO = ['estado'];
const ALIAS_FECHA_NACIMIENTO = [
  'fecha_nacimiento',
  'fecha nacimiento',
  'fecha de nacimiento',
  'f nacimiento',
];

/** En orden de prioridad: si una columna calza con dos campos, gana el primero. */
const ALIAS_CAMPOS: Array<[CampoModeloBeneficiario, string[]]> = [
  ['numeroDocumento', [...ALIAS_ID, 'numero de documento', 'no documento', 'documento de identidad', 'numero de identificacion', 'identificacion']],
  ['tipoDocumento', [...ALIAS_TIPO, 'tipo de documento', 'tipo identificacion']],
  ['primerNombre', ALIAS_PRIMER_NOMBRE],
  ['segundoNombre', ALIAS_SEGUNDO_NOMBRE],
  ['primerApellido', ALIAS_PRIMER_APELLIDO],
  ['segundoApellido', ALIAS_SEGUNDO_APELLIDO],
  ['nombres', [...ALIAS_NOMBRE, 'nombres y apellidos', 'nombre y apellidos', 'nombre del beneficiario']],
  ['apellidos', ALIAS_APELLIDOS],
  ['telefono', [...ALIAS_TELEFONO, 'telefono celular', 'numero de contacto', 'contacto']],
  ['correo', [...ALIAS_CORREO, 'e mail']],
  ['genero', ALIAS_SEXO],
  ['edad', ALIAS_EDAD],
  ['fechaNacimiento', ALIAS_FECHA_NACIMIENTO],
  ['municipio', ALIAS_MUNICIPIO],
  ['lineaProductiva', ALIAS_LINEA],
  ['nombreAsociacion', [...ALIAS_ASOCIACION, 'nombre de la asociacion', 'organizacion']],
  ['estado', ALIAS_ESTADO],
];

const CAMPOS_MODELO = new Set<CampoModeloBeneficiario>(
  ALIAS_CAMPOS.map(([campo]) => campo),
);

const COLUMNAS_PLANTILLA = [
  { titulo: 'CEDULA', ancho: 16 },
  { titulo: 'PRIMER_NOMBRE', ancho: 18 },
  { titulo: 'SEGUNDO_NOMBRE', ancho: 18 },
  { titulo: 'Columna1', ancho: 28 },
  { titulo: 'PRIMER_APELLIDO', ancho: 20 },
  { titulo: 'SEGUNDO_APELLIDO', ancho: 20 },
  { titulo: 'Columna2', ancho: 28 },
  { titulo: 'SEXO', ancho: 12 },
  { titulo: 'EDAD', ancho: 10 },
  { titulo: 'NO_CONTACTO', ancho: 16 },
  { titulo: 'ASOCIACION', ancho: 36 },
  { titulo: 'MUNICIPIO', ancho: 24 },
  { titulo: 'LINEA_PRODUCTIVA', ancho: 22 },
  { titulo: 'ESTADO', ancho: 14 },
] as const;

function normalizarEncabezado(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function limpiarTexto(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

function celdaTexto(valor: unknown): string {
  if (valor == null) return '';
  if (typeof valor === 'number') {
    if (Number.isInteger(valor)) return String(valor);
    return String(valor).trim();
  }
  if (typeof valor === 'string' || typeof valor === 'boolean') {
    return valor.toString().trim();
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

export function mensajeFilaNoCargada(
  fila: Pick<FilaExcelBeneficiario, 'fila' | 'identificador' | 'nombres' | 'apellidos'>,
  motivo: 'incompleta' | 'duplicada',
): string {
  const nombre = [fila.nombres, fila.apellidos].filter(Boolean).join(' ').trim();
  const quien = nombre || 'Sin nombre';
  if (motivo === 'duplicada') {
    return `${quien}, cédula ${fila.identificador} (fila ${fila.fila}): la cédula está repetida en el archivo`;
  }
  if (!fila.identificador && !fila.nombres) {
    return `Fila ${fila.fila}: faltan la cédula y el nombre`;
  }
  if (!fila.identificador) {
    return `${quien} (fila ${fila.fila}): falta la cédula`;
  }
  return `Fila ${fila.fila}, cédula ${fila.identificador}: falta el nombre`;
}

export function normalizarIdentificador(valor: string): string {
  return valor.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** La cédula es la clave: ignora puntos, espacios y ceros a la izquierda. */
export function sqlCedulaIgual(alias: string): string {
  const limpio = `REGEXP_REPLACE(UPPER(${alias}.numero_documento), '[^A-Z0-9]', '', 'g')`;
  return `(
    ${limpio} = :id
    OR (
      ${limpio} ~ '^[0-9]+$'
      AND :id ~ '^[0-9]+$'
      AND NULLIF(${limpio}, '')::numeric = NULLIF(:id, '')::numeric
    )
  )`;
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

function unirPartes(...partes: Array<string | null | undefined>): string {
  return partes
    .map((parte) => limpiarTexto(parte ?? ''))
    .filter(Boolean)
    .join(' ');
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

function generoDesdeTexto(valor: string): Genero | null {
  const clave = normalizarEncabezado(valor);
  if (!clave) return null;
  if (clave === 'm' || clave === 'masculino' || clave === 'hombre') {
    return Genero.MASCULINO;
  }
  if (clave === 'f' || clave === 'femenino' || clave === 'mujer') {
    return Genero.FEMENINO;
  }
  if (clave === 'otro' || clave === 'o') return Genero.OTRO;
  return null;
}

function edadDesdeTexto(valor: string): number | null {
  if (!valor) return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0 || numero > 130) return null;
  return numero;
}

function activoDesdeTexto(valor: string): boolean {
  const clave = normalizarEncabezado(valor);
  if (!clave) return true;
  if (
    clave === 'inactivo' ||
    clave === 'inactiva' ||
    clave === 'desactivado' ||
    clave === 'desactivada' ||
    clave === 'no' ||
    clave === '0' ||
    clave === 'retirado'
  ) {
    return false;
  }
  return true;
}

/** Encabezado comparable: sin tildes, minúsculas y con `_ . - :` como espacio. */
function claveEncabezado(valor: unknown): string {
  return normalizarEncabezado(valor)
    .replace(/[_.\-:#°º/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let aliasNormalizados: Array<[CampoModeloBeneficiario, Set<string>]> | null =
  null;

function campoPorEncabezado(
  encabezado: string,
  usados: Set<CampoModeloBeneficiario>,
): CampoModeloBeneficiario | null {
  aliasNormalizados ??= ALIAS_CAMPOS.map(([campo, alias]) => [
    campo,
    new Set(alias.map(claveEncabezado)),
  ]);
  const clave = claveEncabezado(encabezado);
  if (!clave) return null;
  for (const [campo, alias] of aliasNormalizados) {
    if (!usados.has(campo) && alias.has(clave)) return campo;
  }
  return null;
}

/** Valor de la celda sin envoltorios de exceljs (fórmula, texto enriquecido, hipervínculo). */
function valorPrimitivo(valor: unknown): string | number | boolean | Date | null {
  if (valor == null) return null;
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string') return limpiarTexto(valor) || null;
  if (typeof valor === 'object') {
    const objeto = valor as { result?: unknown; formula?: unknown; sharedFormula?: unknown };
    if ('result' in objeto) return valorPrimitivo(objeto.result);
    if ('formula' in objeto || 'sharedFormula' in objeto) return null;
    return limpiarTexto(celdaTexto(valor)) || null;
  }
  return null;
}

function esFormula(valor: unknown): boolean {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    ('formula' in valor || 'sharedFormula' in valor)
  );
}

/** Número sin ceros a la izquierda (un "0123" es un código, no un número). */
const REGEX_NUMERO = /^-?(0|[1-9]\d{0,14})([.,]\d+)?$/;
const REGEX_FECHA_DMA = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const REGEX_FECHA_AMD = /^(\d{4})-(\d{2})-(\d{2})/;

function fechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function fechaDesdeTexto(texto: string): string | null {
  const amd = REGEX_FECHA_AMD.exec(texto);
  if (amd) return `${amd[1]}-${amd[2]}-${amd[3]}`;
  const dma = REGEX_FECHA_DMA.exec(texto);
  if (!dma) return null;
  const dia = Number(dma[1]);
  const mes = Number(dma[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return `${dma[3]}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function booleanoDesdeTexto(texto: string): boolean | null {
  const clave = normalizarEncabezado(texto);
  if (['si', 'verdadero', 'true'].includes(clave)) return true;
  if (['no', 'falso', 'false'].includes(clave)) return false;
  return null;
}

function tipoDeValor(
  valor: string | number | boolean | Date,
): TipoCampoBeneficiario {
  if (typeof valor === 'number') return 'numero';
  if (typeof valor === 'boolean') return 'booleano';
  if (valor instanceof Date) return 'fecha';
  if (REGEX_NUMERO.test(valor)) return 'numero';
  if (fechaDesdeTexto(valor)) return 'fecha';
  if (booleanoDesdeTexto(valor) !== null) return 'booleano';
  return 'texto';
}

/** Convierte la celda al tipo del campo. Si no encaja, guarda el texto: nunca se pierde el dato. */
function valorExtra(
  valor: unknown,
  tipo: TipoCampoBeneficiario,
): ValorDatoAdicional | undefined {
  const primitivo = valorPrimitivo(valor);
  if (primitivo === null) return undefined;
  if (tipo === 'numero') {
    if (typeof primitivo === 'number') return primitivo;
    if (typeof primitivo === 'string' && REGEX_NUMERO.test(primitivo)) {
      return Number(primitivo.replace(',', '.'));
    }
  }
  if (tipo === 'fecha') {
    if (primitivo instanceof Date) return fechaIso(primitivo);
    if (typeof primitivo === 'string') {
      const fecha = fechaDesdeTexto(primitivo);
      if (fecha) return fecha;
    }
  }
  if (tipo === 'booleano') {
    if (typeof primitivo === 'boolean') return primitivo;
    if (typeof primitivo === 'string') {
      const booleano = booleanoDesdeTexto(primitivo);
      if (booleano !== null) return booleano;
    }
  }
  const texto =
    primitivo instanceof Date ? fechaIso(primitivo) : String(primitivo);
  return texto.slice(0, MAX_LARGO_VALOR) || undefined;
}

function fechaNacimientoDesdeCelda(valor: unknown): string | null {
  const primitivo = valorPrimitivo(valor);
  if (primitivo instanceof Date) return fechaIso(primitivo);
  if (typeof primitivo === 'string') return fechaDesdeTexto(primitivo);
  return null;
}

/** Clave para el jsonb a partir del encabezado: "Hectáreas sembradas" -> "hectareas_sembradas". */
export function claveDesdeEncabezado(encabezado: string): string {
  const base = normalizarEncabezado(encabezado)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  if (!base) return 'campo';
  return /^[a-z]/.test(base) ? base : `campo_${base}`;
}

function claveUnica(base: string, usadas: Set<string>): string {
  let clave = base;
  let sufijo = 2;
  while (usadas.has(clave)) {
    clave = `${base}_${sufijo}`;
    sufijo += 1;
  }
  usadas.add(clave);
  return clave;
}

function letraColumna(numero: number): string {
  let letra = '';
  let resto = numero;
  while (resto > 0) {
    const modulo = (resto - 1) % 26;
    letra = String.fromCharCode(65 + modulo) + letra;
    resto = Math.floor((resto - 1) / 26);
  }
  return letra;
}

function textoEncabezado(row: ExcelJS.Row, columna: number): string {
  const primitivo = valorPrimitivo(row.getCell(columna).value);
  if (primitivo === null) return '';
  return primitivo instanceof Date ? fechaIso(primitivo) : String(primitivo);
}

function contarColumnas(hoja: ExcelJS.Worksheet, filaEncabezado: number): number {
  const encabezado = hoja.getRow(filaEncabezado).cellCount;
  return Math.min(Math.max(hoja.columnCount, encabezado), MAX_COLUMNAS);
}

/**
 * Fila de encabezados: la primera que tenga cédula y nombre con alias conocidos.
 * Si no hay ninguna, la que tenga más celdas de texto entre las primeras 30.
 */
function buscarFilaEncabezado(hoja: ExcelJS.Worksheet): number {
  const tope = Math.min(hoja.rowCount || 30, 30);
  let mejor = 0;
  let mejorConteo = 1;
  for (let numero = 1; numero <= tope; numero += 1) {
    const row = hoja.getRow(numero);
    const usados = new Set<CampoModeloBeneficiario>();
    let textos = 0;
    row.eachCell((celda) => {
      const primitivo = valorPrimitivo(celda.value);
      if (typeof primitivo === 'string' && tipoDeValor(primitivo) === 'texto') {
        textos += 1;
      }
      const campo = campoPorEncabezado(celdaTexto(celda.value), usados);
      if (campo) usados.add(campo);
    });
    const tieneNombre = usados.has('nombres') || usados.has('primerNombre');
    if (usados.has('numeroDocumento') && tieneNombre) return numero;
    if (textos > mejorConteo) {
      mejor = numero;
      mejorConteo = textos;
    }
  }
  return mejor;
}

interface HojaLeida {
  hoja: ExcelJS.Worksheet;
  filaEncabezado: number;
}

/** Firma de los .xls (Excel 97-2003); exceljs solo lee .xlsx. */
const FIRMA_XLS = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);

export const MENSAJE_SOLO_XLSX =
  'El archivo debe ser Excel .xlsx. Si es .xls (Excel 97-2003), ábrelo en Excel y usa "Guardar como" > "Libro de Excel (.xlsx)".';

async function cargarHoja(buffer: Buffer): Promise<HojaLeida> {
  if (buffer.subarray(0, 4).equals(FIRMA_XLS)) {
    throw new BadRequestException(MENSAJE_SOLO_XLSX);
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException(
      'No se pudo leer el archivo. Guárdalo como Excel (.xlsx) e inténtalo de nuevo.',
    );
  }
  const hoja = wb.worksheets.find((h) => h.rowCount > 0) ?? wb.worksheets[0];
  if (!hoja) {
    throw new BadRequestException('El archivo no tiene hojas');
  }
  const filaEncabezado = buscarFilaEncabezado(hoja);
  if (filaEncabezado < 1) {
    throw new BadRequestException(
      'No se encontró la fila de títulos. La primera fila con datos debe tener el nombre de cada columna.',
    );
  }
  return { hoja, filaEncabezado };
}

function sugerirDestino(
  titulo: string,
  encabezado: string,
  tipo: TipoCampoBeneficiario,
  soloFormulas: boolean,
  conDatos: number,
  usados: Set<CampoModeloBeneficiario>,
  clavesUsadas: Set<string>,
  conocidos: Map<string, CampoConocido>,
): DestinoColumna {
  const campo = campoPorEncabezado(titulo, usados);
  if (campo) {
    usados.add(campo);
    return { destino: 'modelo', campo };
  }
  if (!conDatos || soloFormulas) return { destino: 'ignorar' };
  const conocido = titulo ? conocidos.get(claveEncabezado(titulo)) : undefined;
  if (conocido && !clavesUsadas.has(conocido.clave)) {
    clavesUsadas.add(conocido.clave);
    return {
      destino: 'extra',
      clave: conocido.clave,
      etiqueta: conocido.etiqueta,
      tipo: conocido.tipo,
    };
  }
  return {
    destino: 'extra',
    clave: claveUnica(claveDesdeEncabezado(encabezado), clavesUsadas),
    etiqueta: encabezado.slice(0, 120),
    tipo,
  };
}

function analizarHoja(
  { hoja, filaEncabezado }: HojaLeida,
  camposConocidos: CampoConocido[],
): AnalisisExcelBeneficiarios {
  const totalColumnas = contarColumnas(hoja, filaEncabezado);
  const filaTitulos = hoja.getRow(filaEncabezado);
  const estadisticas = Array.from({ length: totalColumnas + 1 }, () => ({
    conDatos: 0,
    formulas: 0,
    tipos: new Map<TipoCampoBeneficiario, number>(),
    muestras: [] as string[],
  }));

  let totalFilas = 0;
  hoja.eachRow((row, numero) => {
    if (numero <= filaEncabezado) return;
    let tieneDatos = false;
    for (let columna = 1; columna <= totalColumnas; columna += 1) {
      const valor = row.getCell(columna).value;
      const primitivo = valorPrimitivo(valor);
      if (primitivo === null) continue;
      tieneDatos = true;
      const stats = estadisticas[columna];
      stats.conDatos += 1;
      if (esFormula(valor)) stats.formulas += 1;
      const tipo = tipoDeValor(primitivo);
      stats.tipos.set(tipo, (stats.tipos.get(tipo) ?? 0) + 1);
      if (stats.muestras.length < 3) {
        stats.muestras.push(
          primitivo instanceof Date ? fechaIso(primitivo) : String(primitivo),
        );
      }
    }
    if (tieneDatos) totalFilas += 1;
  });

  const conocidos = new Map<string, CampoConocido>();
  for (const campo of camposConocidos) {
    conocidos.set(claveEncabezado(campo.columnaOrigen ?? campo.etiqueta), campo);
    conocidos.set(claveEncabezado(campo.etiqueta), campo);
  }
  const usados = new Set<CampoModeloBeneficiario>();
  const clavesUsadas = new Set<string>();
  const columnas: ColumnaExcelAnalizada[] = [];
  for (let columna = 1; columna <= totalColumnas; columna += 1) {
    const stats = estadisticas[columna];
    const titulo = textoEncabezado(filaTitulos, columna);
    if (!titulo && !stats.conDatos) continue;
    const letra = letraColumna(columna);
    const encabezado = titulo || `Columna ${letra}`;
    const tipoDetectado =
      stats.conDatos && stats.tipos.size === 1
        ? [...stats.tipos.keys()][0]
        : 'texto';
    columnas.push({
      columna,
      letra,
      encabezado,
      muestras: stats.muestras,
      conDatos: stats.conDatos,
      tipoDetectado,
      sugerencia: sugerirDestino(
        titulo,
        encabezado,
        tipoDetectado,
        stats.conDatos > 0 && stats.formulas === stats.conDatos,
        stats.conDatos,
        usados,
        clavesUsadas,
        conocidos,
      ),
    });
  }

  return { hoja: hoja.name, filaEncabezado, totalFilas, columnas };
}

/** Lee el Excel sin guardar nada y propone a qué campo va cada columna. */
export async function analizarExcelBeneficiarios(
  buffer: Buffer,
  camposConocidos: CampoConocido[] = [],
): Promise<AnalisisExcelBeneficiarios> {
  return analizarHoja(await cargarHoja(buffer), camposConocidos);
}

function mapeoDesdeAnalisis(
  analisis: AnalisisExcelBeneficiarios,
): MapeoColumnasBeneficiarios {
  return {
    filaEncabezado: analisis.filaEncabezado,
    columnas: analisis.columnas.map((c) => ({ ...c.sugerencia, columna: c.columna })),
  };
}

/** Valida el mapeo que manda el cliente. Lanza un mensaje claro si algo no cuadra. */
export function validarMapeo(entrada: unknown): MapeoColumnasBeneficiarios {
  const invalido = (detalle: string) =>
    new BadRequestException(`El mapeo de columnas no es válido: ${detalle}`);
  if (typeof entrada !== 'object' || entrada === null) throw invalido('formato');
  const { filaEncabezado, columnas } = entrada as Record<string, unknown>;
  if (!Number.isInteger(filaEncabezado) || (filaEncabezado as number) < 1) {
    throw invalido('fila de títulos');
  }
  if (!Array.isArray(columnas) || columnas.length > MAX_COLUMNAS) {
    throw invalido('columnas');
  }

  const vistasColumnas = new Set<number>();
  const campos = new Set<CampoModeloBeneficiario>();
  const claves = new Set<string>();
  const resultado: ColumnaMapeo[] = [];
  for (const item of columnas as Array<Record<string, unknown>>) {
    const columna = item?.columna;
    if (!Number.isInteger(columna) || (columna as number) < 1) {
      throw invalido('número de columna');
    }
    if (vistasColumnas.has(columna as number)) throw invalido('columna repetida');
    vistasColumnas.add(columna as number);

    if (item.destino === 'ignorar') {
      resultado.push({ columna: columna as number, destino: 'ignorar' });
      continue;
    }
    if (item.destino === 'modelo') {
      const campo = item.campo as CampoModeloBeneficiario;
      if (!CAMPOS_MODELO.has(campo)) throw invalido(`campo "${String(campo)}"`);
      if (campos.has(campo)) {
        throw invalido(`dos columnas van al mismo campo (${campo})`);
      }
      campos.add(campo);
      resultado.push({ columna: columna as number, destino: 'modelo', campo });
      continue;
    }
    if (item.destino === 'extra') {
      const clave = typeof item.clave === 'string' ? item.clave : '';
      const etiqueta = limpiarTexto(
        typeof item.etiqueta === 'string' ? item.etiqueta : '',
      ).slice(0, 120);
      const tipo = item.tipo as TipoCampoBeneficiario;
      if (!REGEX_CLAVE.test(clave)) throw invalido(`clave "${clave}"`);
      if (claves.has(clave)) throw invalido(`clave repetida "${clave}"`);
      if (!etiqueta) throw invalido('un dato adicional no tiene nombre');
      if (!TIPOS_CAMPO.includes(tipo)) throw invalido(`tipo "${String(tipo)}"`);
      claves.add(clave);
      resultado.push({
        columna: columna as number,
        destino: 'extra',
        clave,
        etiqueta,
        tipo,
      });
      continue;
    }
    throw invalido('destino');
  }

  if (claves.size > MAX_CAMPOS_EXTRA) {
    throw new BadRequestException(
      `Se admiten hasta ${MAX_CAMPOS_EXTRA} datos adicionales por carga`,
    );
  }
  if (!campos.has('numeroDocumento') || !(campos.has('nombres') || campos.has('primerNombre'))) {
    throw new BadRequestException(
      'Indica qué columna es la cédula (o identificador) y cuál el nombre (o primer nombre).',
    );
  }
  return { filaEncabezado: filaEncabezado as number, columnas: resultado };
}

/** El mapeo llega como texto JSON en el formulario multipart. Vacío: se usa el automático. */
export function leerMapeoFormulario(
  texto: string | undefined,
): MapeoColumnasBeneficiarios | undefined {
  if (!texto?.trim()) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new BadRequestException('El mapeo de columnas no es JSON válido');
  }
  return validarMapeo(json);
}

function textoColumna(row: ExcelJS.Row, columna: number): string {
  if (columna < 1) return '';
  return limpiarTexto(celdaTexto(row.getCell(columna).value));
}

function ponerSiHayColumna(
  fila: FilaExcelBeneficiario,
  columna: number,
  clave: 'primerNombre' | 'segundoNombre' | 'primerApellido' | 'segundoApellido' | 'municipio' | 'lineaProductiva' | 'nombreAsociacion',
  row: ExcelJS.Row,
) {
  if (columna < 1) return;
  const texto = textoColumna(row, columna);
  fila[clave] = texto || null;
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

export interface ExcelBeneficiariosLeido {
  filas: FilaExcelBeneficiario[];
  mapeo: MapeoColumnasBeneficiarios;
  camposExtra: CampoExtraLeido[];
}

/**
 * Lee las personas del Excel. Con `mapeo` usa la asignación de columnas que eligió
 * el usuario; sin él, la automática por alias (la plantilla de la matriz encaja sola).
 * Las columnas mapeadas como dato adicional quedan en `fila.extras`.
 */
export async function leerExcelBeneficiarios(
  buffer: Buffer,
  opciones: {
    mapeo?: MapeoColumnasBeneficiarios;
    camposConocidos?: CampoConocido[];
  } = {},
): Promise<ExcelBeneficiariosLeido> {
  const leida = await cargarHoja(buffer);
  const mapeo =
    opciones.mapeo ??
    validarMapeo(
      mapeoDesdeAnalisis(analizarHoja(leida, opciones.camposConocidos ?? [])),
    );
  const { hoja } = leida;
  const filaEncabezado = mapeo.filaEncabezado;
  const filaTitulos = hoja.getRow(filaEncabezado);

  const col = new Map<CampoModeloBeneficiario, number>();
  const extras: Array<Extract<ColumnaMapeo, { destino: 'extra' }>> = [];
  for (const columna of mapeo.columnas) {
    if (columna.destino === 'modelo') col.set(columna.campo, columna.columna);
    if (columna.destino === 'extra') extras.push(columna);
  }
  const c = (campo: CampoModeloBeneficiario) => col.get(campo) ?? -1;
  const colNombre = c('nombres');
  const colApellidos = c('apellidos');
  const colPrimerNombre = c('primerNombre');
  const colSegundoNombre = c('segundoNombre');
  const colPrimerApellido = c('primerApellido');
  const colSegundoApellido = c('segundoApellido');
  const colId = c('numeroDocumento');
  const colTipo = c('tipoDocumento');
  const colTel = c('telefono');
  const colCorreo = c('correo');
  const colSexo = c('genero');
  const colEdad = c('edad');
  const colFechaNacimiento = c('fechaNacimiento');
  const colAsociacion = c('nombreAsociacion');
  const colMunicipio = c('municipio');
  const colLinea = c('lineaProductiva');
  const colEstado = c('estado');

  const filas: FilaExcelBeneficiario[] = [];
  hoja.eachRow((row, numero) => {
    if (numero <= filaEncabezado) return;
    const identificador = normalizarIdentificador(textoColumna(row, colId));
    const primerNombre = textoColumna(row, colPrimerNombre);
    const segundoNombre = textoColumna(row, colSegundoNombre);
    const primerApellido = textoColumna(row, colPrimerApellido);
    const segundoApellido = textoColumna(row, colSegundoApellido);
    const nombreCrudo = textoColumna(row, colNombre);
    const apellidosCol = textoColumna(row, colApellidos);

    const nombres = unirPartes(primerNombre, segundoNombre) || nombreCrudo;
    const apellidos =
      unirPartes(primerApellido, segundoApellido) || apellidosCol;
    if (!identificador && !nombres && !apellidos) return;

    const partido = nombres && !apellidos ? partirNombreCompleto(nombres) : null;
    const fila: FilaExcelBeneficiario = {
      fila: numero,
      identificador,
      nombres: partido?.nombres || nombres,
      apellidos: apellidos || partido?.apellidos || '',
      tipoDocumento:
        colTipo > 0
          ? tipoDesdeTexto(textoColumna(row, colTipo))
          : TipoDocumento.CC,
    };

    if (colTel > 0) {
      const telefono = textoColumna(row, colTel);
      if (telefono) fila.telefono = telefono;
    }
    if (colCorreo > 0) {
      const correo = textoColumna(row, colCorreo);
      if (correo) fila.correo = correo;
    }
    ponerSiHayColumna(fila, colPrimerNombre, 'primerNombre', row);
    ponerSiHayColumna(fila, colSegundoNombre, 'segundoNombre', row);
    ponerSiHayColumna(fila, colPrimerApellido, 'primerApellido', row);
    ponerSiHayColumna(fila, colSegundoApellido, 'segundoApellido', row);
    ponerSiHayColumna(fila, colMunicipio, 'municipio', row);
    ponerSiHayColumna(fila, colLinea, 'lineaProductiva', row);
    ponerSiHayColumna(fila, colAsociacion, 'nombreAsociacion', row);
    if (colSexo > 0) fila.genero = generoDesdeTexto(textoColumna(row, colSexo));
    if (colEdad > 0) fila.edad = edadDesdeTexto(textoColumna(row, colEdad));
    if (colFechaNacimiento > 0) {
      const fecha = fechaNacimientoDesdeCelda(row.getCell(colFechaNacimiento).value);
      if (fecha) fila.fechaNacimiento = fecha;
    }
    if (colEstado > 0) fila.estaActivo = activoDesdeTexto(textoColumna(row, colEstado));

    if (extras.length) {
      const datos: DatosAdicionales = {};
      for (const extra of extras) {
        const valor = valorExtra(row.getCell(extra.columna).value, extra.tipo);
        if (valor !== undefined) datos[extra.clave] = valor;
      }
      fila.extras = datos;
    }

    filas.push(fila);
  });

  const camposExtra = extras.map((extra) => ({
    clave: extra.clave,
    etiqueta: extra.etiqueta,
    tipo: extra.tipo,
    columnaOrigen:
      textoEncabezado(filaTitulos, extra.columna) ||
      `Columna ${letraColumna(extra.columna)}`,
  }));

  return { filas, mapeo, camposExtra };
}

function tieneClave(
  fila: FilaExcelBeneficiario,
  clave: keyof FilaExcelBeneficiario,
): boolean {
  return Object.prototype.hasOwnProperty.call(fila, clave);
}

/** Copia al beneficiario los campos que sí vienen en la fila, incluidos los datos adicionales. No borra la vereda si el archivo no trae una. */
export function asignarFilaABeneficiario(
  beneficiario: Beneficiario,
  fila: FilaExcelBeneficiario,
  veredaId?: string,
): void {
  beneficiario.nombres = fila.nombres.trim();
  beneficiario.apellidos = fila.apellidos.trim() || fila.nombres.trim();
  beneficiario.numeroDocumento = fila.identificador;
  beneficiario.tipoDocumento = fila.tipoDocumento;
  if (tieneClave(fila, 'primerNombre')) {
    beneficiario.primerNombre = fila.primerNombre ?? null;
  }
  if (tieneClave(fila, 'segundoNombre')) {
    beneficiario.segundoNombre = fila.segundoNombre ?? null;
  }
  if (tieneClave(fila, 'primerApellido')) {
    beneficiario.primerApellido = fila.primerApellido ?? null;
  }
  if (tieneClave(fila, 'segundoApellido')) {
    beneficiario.segundoApellido = fila.segundoApellido ?? null;
  }
  if (fila.telefono) beneficiario.telefono = fila.telefono;
  if (fila.correo) beneficiario.correo = fila.correo;
  if (tieneClave(fila, 'genero')) beneficiario.genero = fila.genero ?? null;
  if (tieneClave(fila, 'edad')) beneficiario.edad = fila.edad ?? null;
  if (tieneClave(fila, 'municipio')) beneficiario.municipio = fila.municipio ?? null;
  if (tieneClave(fila, 'lineaProductiva')) {
    beneficiario.lineaProductiva = fila.lineaProductiva ?? null;
  }
  if (tieneClave(fila, 'nombreAsociacion')) {
    beneficiario.nombreAsociacion = fila.nombreAsociacion ?? null;
  }
  if (fila.fechaNacimiento) {
    // Texto AAAA-MM-DD a propósito: un Date se guardaría con la zona local y correría un día.
    beneficiario.fechaNacimiento = fila.fechaNacimiento as unknown as Date;
  }
  if (fila.extras && Object.keys(fila.extras).length) {
    // La persona es una sola en la plataforma: lo nuevo pisa lo anterior y las celdas vacías no borran.
    beneficiario.datosAdicionales = {
      ...(beneficiario.datosAdicionales ?? {}),
      ...fila.extras,
    };
  }
  if (tieneClave(fila, 'estaActivo') && fila.estaActivo !== undefined) {
    beneficiario.estaActivo = fila.estaActivo;
  }
  if (veredaId) {
    beneficiario.vereda = { id: veredaId } as Beneficiario['vereda'];
  }
}

export async function generarPlantillaExcelBeneficiarios(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ruralia';
  wb.created = new Date();

  const hoja = wb.addWorksheet('Hoja1', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: TEAL } },
  });

  COLUMNAS_PLANTILLA.forEach((columna, indice) => {
    hoja.getColumn(indice + 1).width = columna.ancho;
  });
  hoja.getColumn(1).numFmt = '@';
  hoja.getColumn(10).numFmt = '@';

  const encabezados = hoja.getRow(1);
  encabezados.height = 22;
  COLUMNAS_PLANTILLA.forEach((columna, indice) => {
    const celda = encabezados.getCell(indice + 1);
    celda.value = columna.titulo;
    celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: BLANCO } };
    celda.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: TEAL },
    };
    celda.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const validacionSexo: ExcelJS.DataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"M,F"'],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Sexo',
    error: 'Usa M o F.',
  };
  const validacionEstado: ExcelJS.DataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"ACTIVO,INACTIVO"'],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Estado',
    error: 'Usa ACTIVO o INACTIVO.',
  };

  const filasPlantilla = 1500;
  for (let fila = 2; fila <= filasPlantilla; fila += 1) {
    const nombres = hoja.getCell(fila, 4);
    nombres.value = { formula: `TRIM(B${fila}&" "&C${fila})` };
    nombres.font = { name: 'Calibri', size: 11, color: { argb: 'FF71717A' } };
    const apellidos = hoja.getCell(fila, 7);
    apellidos.value = { formula: `TRIM(E${fila}&" "&F${fila})` };
    apellidos.font = { name: 'Calibri', size: 11, color: { argb: 'FF71717A' } };
    hoja.getCell(fila, 8).dataValidation = validacionSexo;
    hoja.getCell(fila, 14).dataValidation = validacionEstado;
  }

  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNAS_PLANTILLA.length },
  };

  const guia = wb.addWorksheet('Como llenarla', {
    properties: { tabColor: { argb: NAVY } },
  });
  guia.getColumn(1).width = 28;
  guia.getColumn(2).width = 78;
  guia.mergeCells('A1:B1');
  guia.getRow(1).height = 28;
  const tituloGuia = guia.getCell('A1');
  tituloGuia.value = 'Ruralia · Matriz de beneficiarios';
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

  const notas: Array<[string, string]> = [
    ['CEDULA', 'Obligatoria. Documento, sin puntos ni espacios. Se guarda como cédula de ciudadanía.'],
    ['PRIMER_NOMBRE', 'Obligatorio.'],
    ['SEGUNDO_NOMBRE', 'Opcional.'],
    ['Columna1', 'Se calcula sola: primer nombre y segundo nombre. No la edites.'],
    ['PRIMER_APELLIDO', 'Obligatorio.'],
    ['SEGUNDO_APELLIDO', 'Opcional.'],
    ['Columna2', 'Se calcula sola: primer apellido y segundo apellido. No la edites.'],
    ['SEXO', 'M o F.'],
    ['EDAD', 'Años, número entero.'],
    ['NO_CONTACTO', 'Celular.'],
    ['ASOCIACION', 'Nombre de la asociación, tal como debe quedar en la ficha.'],
    ['MUNICIPIO', 'Municipio de la persona. Cada fila puede traer el suyo.'],
    ['LINEA_PRODUCTIVA', 'Por ejemplo ñame, yuca, plátano, cacao, maíz, aguacate, frijol o ají.'],
    ['ESTADO', 'ACTIVO o INACTIVO. Si lo omites, queda activo.'],
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
    guia.getCell(fila, 1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: TEAL_SOFT },
    };
    guia.getCell(fila, 2).value = nota[1];
    guia.getCell(fila, 2).font = { name: 'Calibri', size: 11, color: { argb: 'FF171717' } };
    guia.getRow(fila).height = 22;
  });

  guia.getCell('A18').value =
    'Escribe en la hoja Hoja1, desde la fila 2. La carga no guarda nada hasta que confirmes en la plataforma. El municipio viaja en cada fila, así que no hace falta elegir una sola vereda para todo el archivo.';
  guia.getCell('A18').font = {
    name: 'Calibri',
    size: 11,
    italic: true,
    color: { argb: TEAL_TEXTO },
  };
  guia.mergeCells('A18:B18');
  guia.getRow(18).height = 36;

  const logo = cargarLogoRuralia();
  if (logo) {
    const imagen = wb.addImage({
      buffer: logo as unknown as ExcelJS.Buffer,
      extension: 'png',
    });
    guia.addImage(imagen, {
      tl: { col: 2.2, row: 0.15 },
      ext: { width: 36, height: 36 },
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
