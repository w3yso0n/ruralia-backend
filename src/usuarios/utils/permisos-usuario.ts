import {
  ROLES_ACCESO_TOTAL,
  ROLES_COORDINACION,
} from '../catalogo-permisos';
import { Usuario } from '../entities/usuario.entity';

/** Unión de claves de permiso de todos los roles del usuario. */
export function obtenerPermisosEfectivos(usuario: Usuario): string[] {
  const set = new Set<string>();
  for (const rol of usuario.roles ?? []) {
    if (rol.estaActivo === false) continue;
    for (const permiso of rol.permisos ?? []) {
      set.add(permiso.clave);
    }
  }
  return [...set].sort();
}

export function usuarioTienePermisos(
  usuario: Usuario,
  claves: string[],
): boolean {
  if (!claves.length) return true;
  const efectivos = new Set(obtenerPermisosEfectivos(usuario));
  return claves.every((clave) => efectivos.has(clave));
}

export function usuarioTieneAlgunPermiso(
  usuario: Usuario,
  claves: string[],
): boolean {
  if (!claves.length) return false;
  const efectivos = new Set(obtenerPermisosEfectivos(usuario));
  return claves.some((clave) => efectivos.has(clave));
}

export function usuarioTieneRol(usuario: Usuario, nombre: string): boolean {
  return (usuario.roles ?? []).some((rol) => rol.nombre === nombre);
}

export function usuarioTieneAccesoTotal(usuario: Usuario): boolean {
  return (usuario.roles ?? []).some((rol) =>
    (ROLES_ACCESO_TOTAL as readonly string[]).includes(rol.nombre),
  );
}

export function usuarioEsCoordinacion(usuario: Usuario): boolean {
  return (usuario.roles ?? []).some((rol) =>
    (ROLES_COORDINACION as readonly string[]).includes(rol.nombre),
  );
}
