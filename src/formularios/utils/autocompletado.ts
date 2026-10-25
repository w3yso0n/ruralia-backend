import { BadRequestException } from '@nestjs/common';
import type { Beneficiario } from '../../beneficiarios/entities/beneficiario.entity';
import type {
  TipoCampoBeneficiario,
  ValorDatoAdicional,
} from '../../beneficiarios/entities/campo-beneficiario.entity';
import { TipoCampo } from '../enums/tipo-campo.enum';
import { TipoPlantilla } from '../enums/tipo-plantilla.enum';

/**
 * Autocompletado de formularios con datos del beneficiario.
 *
 * Cada pregunta (o columna de tabla) puede tener `autocompletar: { origen }`.
 * El origen es `beneficiario.<campo de la ficha>` o `beneficiario.extra.<clave>`
 * (dato adicional de las cargas por Excel). Si la persona tiene el dato, la
 * pregunta queda fija con ese valor y el técnico no la puede cambiar; si no lo
 * tiene, se llena normal. El servidor es quien decide el valor final.
 */

export interface ConfigAutocompletado {
  origen: string;
}

export interface OrigenAutocompletado {
  origen: string;
  etiqueta: string;
  tipo: TipoCampoBeneficiario;
  grupo: 'ficha' | 'adicional';
}

export type ValorAutocompletado = string | number | boolean;

/** Qué vino de la ficha en un envío. Se guarda en `datosRaw.autocompletado`. */
export interface RegistroAutocompletado {
  clave: string;
  origen: string;
  valor: ValorAutocompletado;
  columna?: string;
  beneficiarioId?: string;
}

/** Marca de la fila de una tabla fija: a qué beneficiario de la jornada corresponde. */
export const CLAVE_FILA_BENEFICIARIO = '_beneficiarioId';

const PREFIJO = 'beneficiario.';
const PREFIJO_EXTRA = 'beneficiario.extra.';

type CampoFicha =
  | 'nombreCompleto'
  | 'nombres'
  | 'apellidos'
  | 'primerNombre'
  | 'segundoNombre'
  | 'primerApellido'
  | 'segundoApellido'
  | 'numeroDocumento'
  | 'tipoDocumento'
  | 'telefono'
  | 'correo'
  | 'genero'
  | 'edad'
  | 'fechaNacimiento'
  | 'municipio'
  | 'vereda'
  | 'lineaProductiva'
  | 'nombreAsociacion';

const CAMPOS_FICHA: Array<[CampoFicha, string, TipoCampoBeneficiario]> = [
  ['nombreCompleto', 'Nombre completo', 'texto'],
  ['nombres', 'Nombres', 'texto'],
  ['apellidos', 'Apellidos', 'texto'],
  ['primerNombre', 'Primer nombre', 'texto'],
  ['segundoNombre', 'Segundo nombre', 'texto'],
  ['primerApellido', 'Primer apellido', 'texto'],
  ['segundoApellido', 'Segundo apellido', 'texto'],
  ['numeroDocumento', 'Cédula / documento', 'texto'],
  ['tipoDocumento', 'Tipo de documento', 'texto'],
  ['telefono', 'Teléfono', 'texto'],
  ['correo', 'Correo', 'texto'],
  ['genero', 'Sexo', 'texto'],
  ['edad', 'Edad', 'numero'],
  ['fechaNacimiento', 'Fecha de nacimiento', 'fecha'],
  ['municipio', 'Municipio', 'texto'],
  ['vereda', 'Vereda', 'texto'],
  ['lineaProductiva', 'Línea productiva', 'texto'],
  ['nombreAsociacion', 'Asociación', 'texto'],
];

const TIPOS_FICHA = new Map(
  CAMPOS_FICHA.map(([campo, , tipo]) => [campo, tipo]),
);

export const ORIGENES_FICHA: OrigenAutocompletado[] = CAMPOS_FICHA.map(
  ([campo, etiqueta, tipo]) => ({
    origen: `${PREFIJO}${campo}`,
    etiqueta,
    tipo,
    grupo: 'ficha',
  }),
);

export function origenDeDatoAdicional(clave: string): string {
  return `${PREFIJO_EXTRA}${clave}`;
}

/** Qué tipos de origen acepta cada tipo de pregunta. GPS, fotos, firmas y archivos no se autocompletan. */
const COMPATIBLES: Partial<Record<string, TipoCampoBeneficiario[]>> = {
  [TipoCampo.TEXTO]: ['texto', 'numero', 'fecha', 'booleano'],
  [TipoCampo.NUMERO]: ['numero'],
  [TipoCampo.FECHA]: ['fecha'],
  [TipoCampo.SI_NO]: ['booleano'],
  [TipoCampo.SELECCION_UNICA]: ['texto', 'booleano'],
};

export function tiposCompatibles(tipoCampo: string): TipoCampoBeneficiario[] {
  return COMPATIBLES[tipoCampo] ?? [];
}

export function leerConfig(valor: unknown): ConfigAutocompletado | null {
  if (!valor || typeof valor !== 'object') return null;
  const origen = (valor as { origen?: unknown }).origen;
  return typeof origen === 'string' && origen ? { origen } : null;
}

interface ColumnaConfig {
  clave: string;
  etiqueta?: string;
  tipoCampo?: TipoCampo;
  opciones?: { valores?: unknown };
  autocompletar?: unknown;
}

export interface CampoConAutocompletado {
  clave: string;
  etiqueta: string;
  tipoCampo: TipoCampo;
  opciones?: Record<string, unknown> | null;
  autocompletar?: unknown;
}

export function columnasDeCampo(campo: CampoConAutocompletado): ColumnaConfig[] {
  const columnas = (campo.opciones as { columnas?: unknown } | null)?.columnas;
  if (!Array.isArray(columnas)) return [];
  return columnas.filter(
    (col): col is ColumnaConfig =>
      !!col && typeof col === 'object' && typeof (col as ColumnaConfig).clave === 'string',
  );
}

export function tablaTieneAutocompletado(campo: CampoConAutocompletado): boolean {
  return (
    campo.tipoCampo === TipoCampo.TABLA &&
    columnasDeCampo(campo).some((col) => leerConfig(col.autocompletar))
  );
}

/**
 * Formulario individual con preguntas sueltas autocompletadas: se llena uno por
 * cada beneficiario de la jornada. Sin eso, se llena uno solo, como siempre.
 */
export function plantillaEsPorPersona(
  tipoPlantilla: TipoPlantilla,
  campos: CampoConAutocompletado[],
): boolean {
  return (
    tipoPlantilla !== TipoPlantilla.GRUPAL &&
    campos.some(
      (campo) =>
        campo.tipoCampo !== TipoCampo.TABLA && leerConfig(campo.autocompletar),
    )
  );
}

/** Valida al guardar la plantilla: origen conocido y compatible con el tipo de pregunta. */
export function validarAutocompletadoPlantilla(
  tipoPlantilla: TipoPlantilla,
  campos: CampoConAutocompletado[],
  tiposAdicionales: Map<string, TipoCampoBeneficiario>,
): void {
  const revisar = (
    config: ConfigAutocompletado,
    tipoCampo: string,
    nombre: string,
  ) => {
    const tipoOrigen = tipoDeOrigen(config.origen, tiposAdicionales);
    if (!tipoOrigen) {
      throw new BadRequestException(
        `"${nombre}" se llena con un dato que no existe (${config.origen}).`,
      );
    }
    if (!tiposCompatibles(tipoCampo).includes(tipoOrigen)) {
      throw new BadRequestException(
        `"${nombre}" no se puede llenar con ese dato: el tipo de la pregunta no coincide con el del dato.`,
      );
    }
  };

  for (const campo of campos) {
    const config = leerConfig(campo.autocompletar);
    if (config) {
      if (campo.tipoCampo === TipoCampo.TABLA) {
        throw new BadRequestException(
          `"${campo.etiqueta}" es una lista: el dato se elige en cada columna.`,
        );
      }
      if (tipoPlantilla === TipoPlantilla.GRUPAL) {
        throw new BadRequestException(
          `"${campo.etiqueta}": en un formulario grupal solo se autocompletan las columnas de las listas, porque hay varias personas.`,
        );
      }
      revisar(config, campo.tipoCampo, campo.etiqueta);
    }
    for (const columna of columnasDeCampo(campo)) {
      const configColumna = leerConfig(columna.autocompletar);
      if (!configColumna) continue;
      revisar(
        configColumna,
        columna.tipoCampo ?? TipoCampo.TEXTO,
        `${campo.etiqueta} > ${columna.etiqueta ?? columna.clave}`,
      );
    }
  }
}

function tipoDeOrigen(
  origen: string,
  tiposAdicionales: Map<string, TipoCampoBeneficiario>,
): TipoCampoBeneficiario | undefined {
  if (origen.startsWith(PREFIJO_EXTRA)) {
    return tiposAdicionales.get(origen.slice(PREFIJO_EXTRA.length));
  }
  if (origen.startsWith(PREFIJO)) {
    return TIPOS_FICHA.get(origen.slice(PREFIJO.length) as CampoFicha);
  }
  return undefined;
}

const ETIQUETA_GENERO: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
  OTRO: 'Otro',
};

/** Otras formas de escribir el mismo valor, para encontrarlo entre las opciones de una selección. */
const ALIAS_OPCION: Record<string, string[]> = {
  masculino: ['m', 'hombre', 'masculino'],
  femenino: ['f', 'mujer', 'femenino'],
  otro: ['otro', 'o'],
  cc: ['cc', 'cedula', 'cedula de ciudadania'],
  ce: ['ce', 'cedula de extranjeria'],
  ti: ['ti', 'tarjeta de identidad'],
  pasaporte: ['pasaporte', 'pa', 'pp'],
  si: ['si', 'true'],
  no: ['no', 'false'],
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function edadA(fecha: string, hoy = new Date()): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!partes) return null;
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  let edad = hoy.getFullYear() - anio;
  const mesHoy = hoy.getMonth() + 1;
  if (mesHoy < mes || (mesHoy === mes && hoy.getDate() < dia)) edad -= 1;
  return edad >= 0 && edad <= 130 ? edad : null;
}

function fechaIso(valor: unknown): string | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
  }
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return valor.slice(0, 10);
  }
  return null;
}

/** Valor crudo del beneficiario para un origen, antes de adaptarlo a la pregunta. */
function valorCrudo(
  beneficiario: Beneficiario,
  origen: string,
): ValorDatoAdicional | undefined {
  if (origen.startsWith(PREFIJO_EXTRA)) {
    return beneficiario.datosAdicionales?.[origen.slice(PREFIJO_EXTRA.length)];
  }
  const campo = origen.slice(PREFIJO.length) as CampoFicha;
  switch (campo) {
    case 'nombreCompleto':
      return `${beneficiario.nombres ?? ''} ${beneficiario.apellidos ?? ''}`.trim();
    case 'genero':
      return beneficiario.genero ? ETIQUETA_GENERO[beneficiario.genero] : null;
    case 'vereda':
      return beneficiario.vereda?.nombre ?? null;
    case 'edad':
      if (beneficiario.edad != null) return beneficiario.edad;
      return beneficiario.fechaNacimiento
        ? edadA(fechaIso(beneficiario.fechaNacimiento) ?? '')
        : null;
    case 'fechaNacimiento':
      return fechaIso(beneficiario.fechaNacimiento);
    default: {
      const valor = (beneficiario as unknown as Record<string, unknown>)[campo];
      if (
        typeof valor === 'string' ||
        typeof valor === 'number' ||
        typeof valor === 'boolean'
      ) {
        return valor;
      }
      return null;
    }
  }
}

function opcionesDe(opciones: unknown): string[] {
  const valores = (opciones as { valores?: unknown } | null | undefined)?.valores;
  return Array.isArray(valores)
    ? valores.filter((v): v is string => typeof v === 'string')
    : [];
}

function buscarOpcion(texto: string, opciones: string[]): string | undefined {
  const buscado = normalizar(texto);
  const exacta = opciones.find((opcion) => normalizar(opcion) === buscado);
  if (exacta) return exacta;
  const alias = Object.values(ALIAS_OPCION).find((lista) => lista.includes(buscado));
  if (!alias) return undefined;
  return opciones.find((opcion) => alias.includes(normalizar(opcion)));
}

/**
 * Valor listo para la respuesta (mismo formato que manda la app), o `undefined`
 * si la persona no tiene el dato o no encaja con la pregunta: en ese caso la
 * pregunta queda abierta para llenarse a mano.
 */
export function resolverValor(
  beneficiario: Beneficiario,
  origen: string,
  tipoCampo: TipoCampo,
  opciones?: unknown,
): ValorAutocompletado | undefined {
  const crudo = valorCrudo(beneficiario, origen);
  if (crudo == null || crudo === '') return undefined;

  switch (tipoCampo) {
    case TipoCampo.NUMERO: {
      if (typeof crudo === 'number') return Number.isFinite(crudo) ? crudo : undefined;
      if (typeof crudo === 'string' && /^-?\d+([.,]\d+)?$/.test(crudo.trim())) {
        return Number(crudo.trim().replace(',', '.'));
      }
      return undefined;
    }
    case TipoCampo.FECHA:
      return fechaIso(crudo) ?? undefined;
    case TipoCampo.SI_NO: {
      if (typeof crudo === 'boolean') return crudo;
      const texto = normalizar(String(crudo));
      if (ALIAS_OPCION.si.includes(texto)) return true;
      if (ALIAS_OPCION.no.includes(texto)) return false;
      return undefined;
    }
    case TipoCampo.SELECCION_UNICA: {
      const texto = typeof crudo === 'boolean' ? (crudo ? 'Sí' : 'No') : String(crudo);
      return buscarOpcion(texto, opcionesDe(opciones));
    }
    case TipoCampo.TEXTO: {
      if (typeof crudo === 'boolean') return crudo ? 'Sí' : 'No';
      const fecha = typeof crudo === 'string' ? fechaIso(crudo) : null;
      if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(String(crudo))) {
        const [anio, mes, dia] = fecha.split('-');
        return `${dia}/${mes}/${anio}`;
      }
      return String(crudo);
    }
    default:
      return undefined;
  }
}

export interface RespuestaEntradaAuto {
  claveCampo: string;
  valor: unknown;
}

export interface ContextoAutocompletado {
  /** La persona del formulario (individual por persona). */
  beneficiario: Beneficiario | null;
  /** Todas las personas de la jornada, en orden: dan las filas de las tablas fijas. */
  beneficiariosJornada: Beneficiario[];
  /** Claves que un administrador corrigió a mano: se respetan, no se recalculan. */
  corregidasPorAdmin: Set<string>;
}

function filasDe(valor: unknown): Record<string, unknown>[] {
  const filas = (valor as { filas?: unknown } | null)?.filas;
  if (!Array.isArray(filas)) return [];
  return filas.filter(
    (fila): fila is Record<string, unknown> =>
      !!fila && typeof fila === 'object' && !Array.isArray(fila),
  );
}

/**
 * Pisa con los datos de la ficha lo que mande el cliente en las preguntas
 * autocompletadas. Las tablas con columnas autocompletadas quedan con una fila
 * por beneficiario de la jornada (no se pueden quitar ni agregar).
 */
export function aplicarAutocompletado(
  campos: CampoConAutocompletado[],
  respuestas: RespuestaEntradaAuto[],
  contexto: ContextoAutocompletado,
): { respuestas: RespuestaEntradaAuto[]; registro: RegistroAutocompletado[] } {
  const porClave = new Map(respuestas.map((r) => [r.claveCampo, r.valor]));
  const registro: RegistroAutocompletado[] = [];

  for (const campo of campos) {
    if (contexto.corregidasPorAdmin.has(campo.clave)) continue;

    if (campo.tipoCampo === TipoCampo.TABLA) {
      if (!tablaTieneAutocompletado(campo) || !contexto.beneficiariosJornada.length) {
        continue;
      }
      const columnas = columnasDeCampo(campo);
      const enviadas = new Map(
        filasDe(porClave.get(campo.clave)).map((fila) => [
          fila[CLAVE_FILA_BENEFICIARIO],
          fila,
        ]),
      );
      const filas = contexto.beneficiariosJornada.map((persona) => {
        const fila: Record<string, unknown> = {
          ...(enviadas.get(persona.id) ?? {}),
          [CLAVE_FILA_BENEFICIARIO]: persona.id,
        };
        for (const columna of columnas) {
          const config = leerConfig(columna.autocompletar);
          if (!config) continue;
          const valor = resolverValor(
            persona,
            config.origen,
            columna.tipoCampo ?? TipoCampo.TEXTO,
            columna.opciones,
          );
          if (valor === undefined) continue;
          fila[columna.clave] = valor;
          registro.push({
            clave: campo.clave,
            columna: columna.clave,
            origen: config.origen,
            valor,
            beneficiarioId: persona.id,
          });
        }
        return fila;
      });
      porClave.set(campo.clave, { filas });
      continue;
    }

    const config = leerConfig(campo.autocompletar);
    if (!config || !contexto.beneficiario) continue;
    const valor = resolverValor(
      contexto.beneficiario,
      config.origen,
      campo.tipoCampo,
      campo.opciones,
    );
    if (valor === undefined) continue;
    porClave.set(campo.clave, valor);
    registro.push({ clave: campo.clave, origen: config.origen, valor });
  }

  return {
    respuestas: [...porClave.entries()].map(([claveCampo, valor]) => ({
      claveCampo,
      valor,
    })),
    registro,
  };
}

/** Valores de una plantilla para una persona, tal como los usa la app para precargar. */
export function valoresParaPersona(
  campos: CampoConAutocompletado[],
  persona: Beneficiario,
): {
  campos: Record<string, ValorAutocompletado>;
  columnas: Record<string, Record<string, ValorAutocompletado>>;
} {
  const valores: Record<string, ValorAutocompletado> = {};
  const columnas: Record<string, Record<string, ValorAutocompletado>> = {};
  for (const campo of campos) {
    if (campo.tipoCampo === TipoCampo.TABLA) {
      for (const columna of columnasDeCampo(campo)) {
        const config = leerConfig(columna.autocompletar);
        if (!config) continue;
        const valor = resolverValor(
          persona,
          config.origen,
          columna.tipoCampo ?? TipoCampo.TEXTO,
          columna.opciones,
        );
        if (valor === undefined) continue;
        columnas[campo.clave] ??= {};
        columnas[campo.clave][columna.clave] = valor;
      }
      continue;
    }
    const config = leerConfig(campo.autocompletar);
    if (!config) continue;
    const valor = resolverValor(persona, config.origen, campo.tipoCampo, campo.opciones);
    if (valor !== undefined) valores[campo.clave] = valor;
  }
  return { campos: valores, columnas };
}
