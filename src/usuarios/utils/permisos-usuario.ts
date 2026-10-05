import { PERMISOS_MAXIMOS_JORNADAS_ASIGNADAS } from '../catalogo-permisos';
import { Usuario } from '../entities/usuario.entity';
import {
  NivelAccesoRol,
  ORDEN_NIVEL_ACCESO,
} from '../enums/nivel-acceso-rol.enum';

/** Unión de claves de permiso de todos los roles del usuario. */
export function obtenerPermisosEfectivos(usuario: Usuario): string[] {
  const set = new Set<string>();
  for (const rol of usuario.roles ?? []) {
    if (rol.estaActivo === false) continue;
    for (const permiso of rol.permisos ?? []) {
      set.add(permiso.clave);
    }
  }
  if (usuarioSoloJornadasAsignadas(usuario)) {
    const permitidos = new Set(PERMISOS_MAXIMOS_JORNADAS_ASIGNADAS);
    return [...set].filter((clave) => permitidos.has(clave)).sort();
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

/**
 * Nivel de acceso más amplio entre los roles activos del usuario.
 * Sin roles activos se trata como el más restrictivo.
 */
export function nivelAccesoUsuario(usuario: Usuario): NivelAccesoRol {
  let mejor = ORDEN_NIVEL_ACCESO.length - 1;
  for (const rol of usuario.roles ?? []) {
    if (rol.estaActivo === false) continue;
    const idx = ORDEN_NIVEL_ACCESO.indexOf(rol.nivelAcceso);
    if (idx !== -1 && idx < mejor) mejor = idx;
  }
  return ORDEN_NIVEL_ACCESO[mejor];
}

export function usuarioTieneAccesoTotal(usuario: Usuario): boolean {
  return nivelAccesoUsuario(usuario) === NivelAccesoRol.TOTAL;
}

/** Coordinación territorial: gestiona los proyectos de su territorio y su equipo. */
export function usuarioEsCoordinacion(usuario: Usuario): boolean {
  return nivelAccesoUsuario(usuario) === NivelAccesoRol.TERRITORIAL;
}

/** Puede gestionar (crear/asignar jornadas, revisar) dentro de algún proyecto. */
export function usuarioGestionaProyectos(usuario: Usuario): boolean {
  return nivelAccesoUsuario(usuario) !== NivelAccesoRol.JORNADAS_ASIGNADAS;
}

/** Solo opera las jornadas donde es responsable o parte del equipo. */
export function usuarioSoloJornadasAsignadas(usuario: Usuario): boolean {
  return nivelAccesoUsuario(usuario) === NivelAccesoRol.JORNADAS_ASIGNADAS;
}
