import { BadRequestException } from '@nestjs/common';
import type {
  TipoCampoBeneficiario,
  ValorDatoAdicional,
} from '../../beneficiarios/entities/campo-beneficiario.entity';
import { Genero } from '../../beneficiarios/enums/genero.enum';
import { TipoDocumento } from '../../beneficiarios/enums/tipo-documento.enum';
import { FaseFormulario } from '../enums/fase-formulario.enum';
import { TipoCampo } from '../enums/tipo-campo.enum';
import { tiposCompatibles } from './autocompletado';

/**
 * Vínculo de una pregunta de línea base con un dato del beneficiario.
 *
 * `destino` sigue la nomenclatura del autocompletado (`beneficiario.<campo>`
 * o `beneficiario.extra.<clave>`), así la misma pregunta lee y escribe el
 * mismo dato.
 *
 * `permitirCambio`: hoy siempre false. Al guardar la plantilla, una pregunta
 * vinculada recibe `autocompletar` con el mismo dato: si el beneficiario ya lo
 * tiene, sale fijo y el técnico no lo puede modificar; si no lo tiene, el
 * técnico lo captura y al aprobar se guarda. Para dejar que el técnico corrija
 * un valor existente basta con enviar `permitirCambio: true`: la plantilla ya
 * no le pondrá `autocompletar` (ver `normalizarVinculos`).
 */
export interface VinculoBeneficiario {
  destino: string;
  permitirCambio?: boolean;
}

export const PREFIJO_DESTINO = 'beneficiario.';
export const PREFIJO_DESTINO_EXTRA = 'beneficiario.extra.';

/** Destino especial: vereda PDET (solo preguntas de tipo VEREDA_PDET). */
export const DESTINO_VEREDA_PDET = 'beneficiario.veredaPdet';

/**
 * Campos fijos del beneficiario que la línea base puede escribir. No se
 * incluyen la identidad (documento, nombre completo) ni la vereda DANE, que
 * se gestiona por catálogo.
 */
export type CampoEscribible =
  | 'nombres'
  | 'apellidos'
  | 'primerNombre'
  | 'segundoNombre'
  | 'primerApellido'
  | 'segundoApellido'
  | 'tipoDocumento'
  | 'telefono'
  | 'correo'
  | 'genero'
  | 'edad'
  | 'fechaNacimiento'
  | 'municipio'
  | 'lineaProductiva'
  | 'nombreAsociacion';

export interface DestinoEscribible {
  destino: string;
  etiqueta: string;
  tipo: TipoCampoBeneficiario | 'vereda_pdet';
  grupo: 'ficha' | 'adicional';
}

const CAMPOS_ESCRIBIBLES: Array<
  [CampoEscribible, string, TipoCampoBeneficiario]
> = [
  ['nombres', 'Nombres', 'texto'],
  ['apellidos', 'Apellidos', 'texto'],
  ['primerNombre', 'Primer nombre', 'texto'],
  ['segundoNombre', 'Segundo nombre', 'texto'],
  ['primerApellido', 'Primer apellido', 'texto'],
  ['segundoApellido', 'Segundo apellido', 'texto'],
  ['tipoDocumento', 'Tipo de documento', 'texto'],
  ['telefono', 'Teléfono', 'texto'],
  ['correo', 'Correo', 'texto'],
  ['genero', 'Sexo', 'texto'],
  ['edad', 'Edad', 'numero'],
  ['fechaNacimiento', 'Fecha de nacimiento', 'fecha'],
  ['municipio', 'Municipio', 'texto'],
  ['lineaProductiva', 'Línea productiva', 'texto'],
  ['nombreAsociacion', 'Asociación', 'texto'],
];

const TIPO_ESCRIBIBLE = new Map<string, TipoCampoBeneficiario>(
  CAMPOS_ESCRIBIBLES.map(([campo, , tipo]) => [campo, tipo]),
);

export const DESTINOS_FICHA: DestinoEscribible[] = [
  ...CAMPOS_ESCRIBIBLES.map(
    ([campo, etiqueta, tipo]): DestinoEscribible => ({
      destino: `${PREFIJO_DESTINO}${campo}`,
      etiqueta,
      tipo,
      grupo: 'ficha',
    }),
  ),
  {
    destino: DESTINO_VEREDA_PDET,
    etiqueta: 'Vereda PDET',
    tipo: 'vereda_pdet',
    grupo: 'ficha',
  },
];

/** Qué tipos de dato puede escribir cada tipo de pregunta. */
const COMPATIBLES_ESCRITURA: Partial<
  Record<TipoCampo, Array<TipoCampoBeneficiario | 'vereda_pdet'>>
> = {
  [TipoCampo.TEXTO]: ['texto'],
  [TipoCampo.NUMERO]: ['numero', 'texto'],
  [TipoCampo.FECHA]: ['fecha', 'texto'],
  [TipoCampo.SI_NO]: ['booleano', 'texto'],
  [TipoCampo.SELECCION_UNICA]: ['texto'],
  [TipoCampo.SELECCION_MULTIPLE]: ['texto'],
  [TipoCampo.VEREDA_PDET]: ['vereda_pdet'],
};

export function tiposEscribibles(
  tipoCampo: TipoCampo,
): Array<TipoCampoBeneficiario | 'vereda_pdet'> {
  return COMPATIBLES_ESCRITURA[tipoCampo] ?? [];
}

export function leerVinculo(valor: unknown): VinculoBeneficiario | null {
  if (!valor || typeof valor !== 'object') return null;
  const { destino, permitirCambio } = valor as {
    destino?: unknown;
    permitirCambio?: unknown;
  };
  if (typeof destino !== 'string' || !destino) return null;
  return { destino, permitirCambio: permitirCambio === true };
}

export function esDestinoExtra(destino: string): boolean {
  return destino.startsWith(PREFIJO_DESTINO_EXTRA);
}

export function claveExtra(destino: string): string {
  return destino.slice(PREFIJO_DESTINO_EXTRA.length);
}

/** Tipo del dato de destino, o undefined si el destino no existe o no se puede escribir. */
export function tipoDeDestino(
  destino: string,
  tiposAdicionales: Map<string, TipoCampoBeneficiario>,
): TipoCampoBeneficiario | 'vereda_pdet' | undefined {
  if (destino === DESTINO_VEREDA_PDET) return 'vereda_pdet';
  if (esDestinoExtra(destino)) return tiposAdicionales.get(claveExtra(destino));
  if (destino.startsWith(PREFIJO_DESTINO)) {
    return TIPO_ESCRIBIBLE.get(destino.slice(PREFIJO_DESTINO.length));
  }
  return undefined;
}

export interface CampoConVinculo {
  clave: string;
  etiqueta: string;
  tipoCampo: TipoCampo;
  autocompletar?: unknown;
  vincularBeneficiario?: unknown;
}

/**
 * Valida los vínculos al guardar la plantilla: solo en línea base, destino
 * conocido, tipo compatible y un dato por pregunta (dos preguntas no pueden
 * escribir el mismo dato).
 */
export function validarVinculosPlantilla(
  fase: FaseFormulario,
  campos: CampoConVinculo[],
  tiposAdicionales: Map<string, TipoCampoBeneficiario>,
): void {
  const usados = new Map<string, string>();
  for (const campo of campos) {
    const vinculo = leerVinculo(campo.vincularBeneficiario);
    if (!vinculo) continue;
    if (fase !== FaseFormulario.LINEA_BASE) {
      throw new BadRequestException(
        `"${campo.etiqueta}": solo las preguntas de un formulario de línea base se pueden guardar en el beneficiario.`,
      );
    }
    const tipo = tipoDeDestino(vinculo.destino, tiposAdicionales);
    if (!tipo) {
      throw new BadRequestException(
        `"${campo.etiqueta}" se guarda en un dato que no existe o no se puede modificar (${vinculo.destino}).`,
      );
    }
    if (!tiposEscribibles(campo.tipoCampo).includes(tipo)) {
      throw new BadRequestException(
        `"${campo.etiqueta}" no se puede guardar en ese dato: el tipo de la pregunta no coincide con el del dato.`,
      );
    }
    const otra = usados.get(vinculo.destino);
    if (otra) {
      throw new BadRequestException(
        `"${campo.etiqueta}" y "${otra}" se guardan en el mismo dato del beneficiario. Cada dato solo puede venir de una pregunta.`,
      );
    }
    usados.set(vinculo.destino, campo.etiqueta);
  }
}

/**
 * La pregunta se puede prellenar con el dato solo si el autocompletado acepta
 * ese tipo de dato para ese tipo de pregunta (p. ej. una NUMERO no se llena
 * con un dato de texto). La vereda PDET no se prellena.
 */
function sePuedePrellenar(
  destino: string,
  tipoCampo: TipoCampo,
  tiposAdicionales: Map<string, TipoCampoBeneficiario>,
): boolean {
  const tipo = tipoDeDestino(destino, tiposAdicionales);
  if (!tipo || tipo === 'vereda_pdet') return false;
  return tiposCompatibles(tipoCampo).includes(tipo);
}

/**
 * Deja cada pregunta vinculada lista para guardarse: normaliza el vínculo y,
 * mientras `permitirCambio` sea false, le pone `autocompletar` con el mismo
 * dato para que salga fija cuando el beneficiario ya lo tiene.
 */
export function normalizarVinculos<T extends CampoConVinculo>(
  campos: T[],
  tiposAdicionales: Map<string, TipoCampoBeneficiario>,
): Array<T & { autocompletar?: unknown }> {
  return campos.map((campo) => {
    const vinculo = leerVinculo(campo.vincularBeneficiario);
    if (!vinculo) return { ...campo, vincularBeneficiario: null };
    const autocompletar =
      !vinculo.permitirCambio &&
      sePuedePrellenar(vinculo.destino, campo.tipoCampo, tiposAdicionales)
        ? { origen: vinculo.destino }
        : campo.autocompletar;
    return { ...campo, vincularBeneficiario: vinculo, autocompletar };
  });
}

/** Respuesta guardada, en la forma de `respuestas_formulario`. */
export interface RespuestaGuardada {
  valorTexto?: string | null;
  valorNumero?: number | string | null;
  valorFecha?: Date | string | null;
  valorBooleano?: boolean | null;
  valorJson?: Record<string, unknown> | null;
}

/** Valor ya convertido para el beneficiario. `undefined` = respuesta vacía o no convertible: no se escribe. */
export type ValorDestino =
  | { tipo: 'escalar'; valor: ValorDatoAdicional }
  | { tipo: 'vereda_pdet'; veredaPdetId: string };

function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const ALIAS_GENERO: Record<string, Genero> = {
  m: Genero.MASCULINO,
  masculino: Genero.MASCULINO,
  hombre: Genero.MASCULINO,
  f: Genero.FEMENINO,
  femenino: Genero.FEMENINO,
  mujer: Genero.FEMENINO,
  otro: Genero.OTRO,
  o: Genero.OTRO,
};

const ALIAS_DOCUMENTO: Record<string, TipoDocumento> = {
  cc: TipoDocumento.CC,
  cedula: TipoDocumento.CC,
  'cedula de ciudadania': TipoDocumento.CC,
  ce: TipoDocumento.CE,
  'cedula de extranjeria': TipoDocumento.CE,
  ti: TipoDocumento.TI,
  'tarjeta de identidad': TipoDocumento.TI,
  pasaporte: TipoDocumento.PASAPORTE,
  pa: TipoDocumento.PASAPORTE,
  pp: TipoDocumento.PASAPORTE,
};

function fechaIso(valor: unknown): string | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime())
      ? null
      : valor.toISOString().slice(0, 10);
  }
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return valor.slice(0, 10);
  }
  return null;
}

/** Valor "natural" de la respuesta según el tipo de pregunta. */
function valorDeRespuesta(
  tipoCampo: TipoCampo,
  respuesta: RespuestaGuardada,
): ValorDatoAdicional | string[] | undefined {
  switch (tipoCampo) {
    case TipoCampo.NUMERO: {
      if (respuesta.valorNumero == null) return undefined;
      const n = Number(respuesta.valorNumero);
      return Number.isFinite(n) ? n : undefined;
    }
    case TipoCampo.FECHA:
      return fechaIso(respuesta.valorFecha) ?? undefined;
    case TipoCampo.SI_NO:
      return respuesta.valorBooleano ?? undefined;
    case TipoCampo.SELECCION_MULTIPLE: {
      const json = respuesta.valorJson as
        | { valor?: unknown }
        | unknown[]
        | null;
      const lista = Array.isArray(json)
        ? json
        : Array.isArray((json as { valor?: unknown })?.valor)
          ? (json as { valor: unknown[] }).valor
          : [];
      const textos = lista.filter((v): v is string => typeof v === 'string');
      return textos.length ? textos : undefined;
    }
    default: {
      const texto = respuesta.valorTexto?.trim();
      return texto ? texto : undefined;
    }
  }
}

/**
 * Convierte una respuesta al valor que se guarda en el destino. Devuelve
 * undefined si la respuesta está vacía o no encaja (p. ej. un sexo que no es
 * de la lista): en ese caso el dato del beneficiario no se toca.
 */
export function valorParaDestino(
  destino: string,
  tipoDestino: TipoCampoBeneficiario | 'vereda_pdet',
  tipoCampo: TipoCampo,
  respuesta: RespuestaGuardada,
): ValorDestino | undefined {
  if (tipoDestino === 'vereda_pdet') {
    const id = (respuesta.valorJson as { veredaPdetId?: unknown } | null)
      ?.veredaPdetId;
    return typeof id === 'string' && id
      ? { tipo: 'vereda_pdet', veredaPdetId: id }
      : undefined;
  }

  const crudo = valorDeRespuesta(tipoCampo, respuesta);
  if (crudo === undefined) return undefined;

  let valor: ValorDatoAdicional;
  if (Array.isArray(crudo)) {
    valor = crudo.join('; ');
  } else if (tipoDestino === 'texto') {
    valor = typeof crudo === 'boolean' ? (crudo ? 'Sí' : 'No') : String(crudo);
  } else if (tipoDestino === 'numero') {
    if (typeof crudo !== 'number') return undefined;
    valor = crudo;
  } else if (tipoDestino === 'fecha') {
    const iso = fechaIso(crudo);
    if (!iso) return undefined;
    valor = iso;
  } else {
    if (typeof crudo !== 'boolean') return undefined;
    valor = crudo;
  }

  const campo = destino.slice(PREFIJO_DESTINO.length);
  if (campo === 'genero') {
    const genero = ALIAS_GENERO[normalizarTexto(String(valor))];
    return genero ? { tipo: 'escalar', valor: genero } : undefined;
  }
  if (campo === 'tipoDocumento') {
    const tipo = ALIAS_DOCUMENTO[normalizarTexto(String(valor))];
    return tipo ? { tipo: 'escalar', valor: tipo } : undefined;
  }
  if (campo === 'edad') {
    const edad = Number(valor);
    return Number.isInteger(edad) && edad >= 0 && edad <= 130
      ? { tipo: 'escalar', valor: edad }
      : undefined;
  }
  return { tipo: 'escalar', valor };
}

/** Etiqueta legible del destino para el historial. */
export function etiquetaDestino(
  destino: string,
  etiquetasAdicionales: Map<string, string>,
): string {
  if (esDestinoExtra(destino)) {
    return etiquetasAdicionales.get(claveExtra(destino)) ?? claveExtra(destino);
  }
  return DESTINOS_FICHA.find((d) => d.destino === destino)?.etiqueta ?? destino;
}
