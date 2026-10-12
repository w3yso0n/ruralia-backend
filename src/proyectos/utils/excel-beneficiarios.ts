import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Beneficiario } from '../../beneficiarios/entities/beneficiario.entity';
import { Genero } from '../../beneficiarios/enums/genero.enum';
import { TipoDocumento } from '../../beneficiarios/enums/tipo-documento.enum';

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
  /** Solo viene si el archivo tiene columna ESTADO. */
  estaActivo?: boolean;
}

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

function indiceColumna(encabezados: string[], alias: string[]): number {
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
  const tope = Math.min(hoja.rowCount || 30, 30);
  for (let numero = 1; numero <= tope; numero += 1) {
    const encabezados = leerEncabezados(hoja.getRow(numero));
    const tieneId = indiceColumna(encabezados, ALIAS_ID) >= 0;
    const tieneNombre =
      indiceColumna(encabezados, ALIAS_NOMBRE) >= 0 ||
      indiceColumna(encabezados, ALIAS_PRIMER_NOMBRE) >= 0;
    if (tieneId && tieneNombre) {
      encontrada = numero;
      break;
    }
  }
  return encontrada;
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

export async function parsearExcelBeneficiarios(
  buffer: Buffer,
): Promise<FilaExcelBeneficiario[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const hoja = wb.worksheets[0];
  if (!hoja) return [];

  const filaEncabezado = buscarFilaEncabezado(hoja);
  if (filaEncabezado < 1) {
    throw new BadRequestException(
      'El Excel debe tener cédula (o identificador) y primer nombre (o nombres).',
    );
  }

  const encabezados = leerEncabezados(hoja.getRow(filaEncabezado));
  const colNombre = indiceColumna(encabezados, ALIAS_NOMBRE);
  const colApellidos = indiceColumna(encabezados, ALIAS_APELLIDOS);
  const colPrimerNombre = indiceColumna(encabezados, ALIAS_PRIMER_NOMBRE);
  const colSegundoNombre = indiceColumna(encabezados, ALIAS_SEGUNDO_NOMBRE);
  const colPrimerApellido = indiceColumna(encabezados, ALIAS_PRIMER_APELLIDO);
  const colSegundoApellido = indiceColumna(encabezados, ALIAS_SEGUNDO_APELLIDO);
  const colId = indiceColumna(encabezados, ALIAS_ID);
  const colTipo = indiceColumna(encabezados, ALIAS_TIPO);
  const colTel = indiceColumna(encabezados, ALIAS_TELEFONO);
  const colCorreo = indiceColumna(encabezados, ALIAS_CORREO);
  const colSexo = indiceColumna(encabezados, ALIAS_SEXO);
  const colEdad = indiceColumna(encabezados, ALIAS_EDAD);
  const colAsociacion = indiceColumna(encabezados, ALIAS_ASOCIACION);
  const colMunicipio = indiceColumna(encabezados, ALIAS_MUNICIPIO);
  const colLinea = indiceColumna(encabezados, ALIAS_LINEA);
  const colEstado = indiceColumna(encabezados, ALIAS_ESTADO);

  if (colId < 1 || (colNombre < 1 && colPrimerNombre < 1)) {
    throw new BadRequestException(
      'El Excel debe tener cédula (o identificador) y primer nombre (o nombres).',
    );
  }

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
    if (colEstado > 0) fila.estaActivo = activoDesdeTexto(textoColumna(row, colEstado));

    filas.push(fila);
  });

  return filas;
}

function tieneClave(
  fila: FilaExcelBeneficiario,
  clave: keyof FilaExcelBeneficiario,
): boolean {
  return Object.prototype.hasOwnProperty.call(fila, clave);
}

/** Copia al beneficiario los campos que sí vienen en la fila. No borra la vereda si el archivo no trae una. */
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
