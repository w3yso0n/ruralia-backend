import { Repository } from 'typeorm';
import { Beneficiario } from '../entities/beneficiario.entity';
import {
  asignarFilaABeneficiario,
  normalizarIdentificador,
  type FilaExcelBeneficiario,
} from '../../proyectos/utils/excel-beneficiarios';

export interface CambioDatoBeneficiario {
  campo: string;
  etiqueta: string;
  antes: string | null;
  despues: string | null;
}

/** Fila de la revisión: lo que trae el Excel y, si la cédula ya existe, qué se le va a sobrescribir. */
export type FilaExcelRevisada = FilaExcelBeneficiario & {
  yaExiste: boolean;
  cambios: CambioDatoBeneficiario[];
};

const CAMPOS_COMPARADOS: Array<[keyof Beneficiario, string]> = [
  ['nombres', 'Nombres'],
  ['apellidos', 'Apellidos'],
  ['primerNombre', 'Primer nombre'],
  ['segundoNombre', 'Segundo nombre'],
  ['primerApellido', 'Primer apellido'],
  ['segundoApellido', 'Segundo apellido'],
  ['tipoDocumento', 'Tipo de documento'],
  ['telefono', 'Teléfono'],
  ['correo', 'Correo'],
  ['genero', 'Sexo'],
  ['edad', 'Edad'],
  ['fechaNacimiento', 'Fecha de nacimiento'],
  ['municipio', 'Municipio'],
  ['lineaProductiva', 'Línea productiva'],
  ['nombreAsociacion', 'Asociación'],
  ['estaActivo', 'Estado'],
];

function comoTexto(campo: string, valor: unknown): string | null {
  if (valor == null || valor === '') return null;
  if (campo === 'estaActivo') return valor ? 'Activo' : 'Inactivo';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

/**
 * Qué cambiaría en la persona si se aplica la fila. No toca `actual`:
 * trabaja sobre una copia con la misma lógica que la carga real.
 */
export function calcularCambios(
  actual: Beneficiario,
  fila: FilaExcelBeneficiario,
  etiquetasExtra: Map<string, string>,
): CambioDatoBeneficiario[] {
  const copia = Object.assign(new Beneficiario(), actual);
  asignarFilaABeneficiario(copia, fila);
  const cambios: CambioDatoBeneficiario[] = [];
  for (const [campo, etiqueta] of CAMPOS_COMPARADOS) {
    const antes = comoTexto(campo, actual[campo]);
    const despues = comoTexto(campo, copia[campo]);
    if (antes !== despues) cambios.push({ campo, etiqueta, antes, despues });
  }
  for (const [clave, valor] of Object.entries(fila.extras ?? {})) {
    const antes = comoTexto(clave, actual.datosAdicionales?.[clave]);
    const despues = comoTexto(clave, valor);
    if (antes !== despues) {
      cambios.push({
        campo: clave,
        etiqueta: etiquetasExtra.get(clave) ?? clave,
        antes,
        despues,
      });
    }
  }
  return cambios;
}

/** Misma regla que `sqlCedulaIgual`: sin signos y sin ceros a la izquierda en cédulas numéricas. */
function claveCedula(identificador: string): string {
  const limpio = normalizarIdentificador(identificador);
  return /^[0-9]+$/.test(limpio) ? limpio.replace(/^0+(?=.)/, '') : limpio;
}

const SQL_CEDULA_LIMPIA = `REGEXP_REPLACE(UPPER(b.numero_documento), '[^A-Z0-9]', '', 'g')`;

/** Busca en lote (no una consulta por fila) a las personas que ya existen. */
async function buscarPorCedulas(
  repo: Repository<Beneficiario>,
  identificadores: string[],
): Promise<Map<string, Beneficiario>> {
  const claves = [...new Set(identificadores.filter(Boolean).map(claveCedula))];
  const encontrados = new Map<string, Beneficiario>();
  for (let inicio = 0; inicio < claves.length; inicio += 1000) {
    const lote = claves.slice(inicio, inicio + 1000);
    const filas = await repo
      .createQueryBuilder('b')
      .where(
        `(CASE WHEN ${SQL_CEDULA_LIMPIA} ~ '^[0-9]+$'
          THEN REGEXP_REPLACE(${SQL_CEDULA_LIMPIA}, '^0+(?=.)', '')
          ELSE ${SQL_CEDULA_LIMPIA} END) IN (:...lote)`,
        { lote },
      )
      .getMany();
    for (const beneficiario of filas) {
      encontrados.set(claveCedula(beneficiario.numeroDocumento), beneficiario);
    }
  }
  return encontrados;
}

/** Marca qué filas son personas que ya están en la plataforma y qué se les va a modificar. */
export async function revisarFilasExistentes(
  repo: Repository<Beneficiario>,
  filas: FilaExcelBeneficiario[],
  etiquetasExtra: Map<string, string>,
): Promise<FilaExcelRevisada[]> {
  const existentes = await buscarPorCedulas(
    repo,
    filas.map((fila) => fila.identificador),
  );
  return filas.map((fila) => {
    const actual = fila.identificador
      ? existentes.get(claveCedula(fila.identificador))
      : undefined;
    if (!actual || actual.eliminadoEn) {
      return { ...fila, yaExiste: false, cambios: [] };
    }
    return {
      ...fila,
      yaExiste: true,
      cambios: calcularCambios(actual, fila, etiquetasExtra),
    };
  });
}

export function resumirCambios(cambios: CambioDatoBeneficiario[]): string {
  return cambios
    .map(
      (cambio) =>
        `${cambio.etiqueta}: ${cambio.antes ?? '(vacío)'} -> ${cambio.despues ?? '(vacío)'}`,
    )
    .join('; ');
}
