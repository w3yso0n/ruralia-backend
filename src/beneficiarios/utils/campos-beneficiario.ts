import { BadRequestException } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import {
  CampoBeneficiario,
  DatosAdicionales,
} from '../entities/campo-beneficiario.entity';
import type {
  CampoConocido,
  CampoExtraLeido,
} from '../../proyectos/utils/excel-beneficiarios';

function filtroProyecto(proyectoId: string | null) {
  return proyectoId ? { proyecto: { id: proyectoId } } : { proyecto: IsNull() };
}

/** Definiciones de datos adicionales de un proyecto (o del catálogo con `null`), en orden. */
export function listarCamposBeneficiario(
  repo: Repository<CampoBeneficiario>,
  proyectoId: string | null,
): Promise<CampoBeneficiario[]> {
  return repo.find({
    where: filtroProyecto(proyectoId),
    order: { orden: 'ASC', creadoEn: 'ASC' },
  });
}

export async function camposConocidos(
  repo: Repository<CampoBeneficiario>,
  proyectoId: string | null,
): Promise<CampoConocido[]> {
  const campos = await listarCamposBeneficiario(repo, proyectoId);
  return campos.map(({ clave, etiqueta, tipo, columnaOrigen }) => ({
    clave,
    etiqueta,
    tipo,
    columnaOrigen,
  }));
}

/** Crea las definiciones que falten. Las existentes conservan su etiqueta y orden. */
export async function registrarCamposBeneficiario(
  repo: Repository<CampoBeneficiario>,
  proyectoId: string | null,
  campos: CampoExtraLeido[],
): Promise<void> {
  if (!campos.length) return;
  const existentes = await listarCamposBeneficiario(repo, proyectoId);
  const claves = new Set(existentes.map((campo) => campo.clave));
  let orden = existentes.reduce((max, campo) => Math.max(max, campo.orden), -1);
  const nuevos = campos
    .filter((campo) => !claves.has(campo.clave))
    .map((campo) => {
      orden += 1;
      return repo.create({
        proyecto: proyectoId ? { id: proyectoId } : null,
        clave: campo.clave,
        etiqueta: campo.etiqueta,
        tipo: campo.tipo,
        columnaOrigen: campo.columnaOrigen.slice(0, 200),
        orden,
      });
    });
  if (nuevos.length) await repo.save(nuevos);
}

const REGEX_CLAVE_DATO = /^[a-z][a-z0-9_]{0,59}$/;
const MAX_DATOS_ADICIONALES = 300;
const MAX_LARGO_DATO = 1000;

/**
 * Edición manual desde la ficha: valida y aplica los cambios. Null o texto vacío
 * borra el dato; las claves que no vienen se conservan.
 */
export function aplicarEdicionDatosAdicionales(
  actuales: DatosAdicionales | null | undefined,
  cambios: Record<string, unknown>,
): DatosAdicionales {
  const resultado: DatosAdicionales = { ...(actuales ?? {}) };
  for (const [clave, valor] of Object.entries(cambios)) {
    if (!REGEX_CLAVE_DATO.test(clave)) {
      throw new BadRequestException(`Dato adicional no válido: "${clave}"`);
    }
    if (valor === null || (typeof valor === 'string' && !valor.trim())) {
      delete resultado[clave];
      continue;
    }
    if (typeof valor === 'string') {
      resultado[clave] = valor.trim().slice(0, MAX_LARGO_DATO);
    } else if (typeof valor === 'number' && Number.isFinite(valor)) {
      resultado[clave] = valor;
    } else if (typeof valor === 'boolean') {
      resultado[clave] = valor;
    } else {
      throw new BadRequestException(
        `El dato adicional "${clave}" debe ser texto, número o sí/no`,
      );
    }
  }
  if (Object.keys(resultado).length > MAX_DATOS_ADICIONALES) {
    throw new BadRequestException('Demasiados datos adicionales');
  }
  return resultado;
}

export function etiquetasDeCampos(
  campos: Array<{ clave: string; etiqueta: string }>,
): Map<string, string> {
  return new Map(campos.map((campo) => [campo.clave, campo.etiqueta]));
}
