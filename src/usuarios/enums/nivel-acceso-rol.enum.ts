/**
 * Qué proyectos alcanza un rol. Los permisos de la matriz definen QUÉ puede
 * hacer; el nivel de acceso define SOBRE QUÉ proyectos lo puede hacer.
 */
export enum NivelAccesoRol {
  /** Ve y gestiona todos los proyectos. */
  TOTAL = 'TOTAL',
  /** Ve y gestiona los proyectos de su territorio asignado y de su equipo. */
  TERRITORIAL = 'TERRITORIAL',
  /** Ve y gestiona solo los proyectos donde está asignado como personal. */
  PROYECTOS_ASIGNADOS = 'PROYECTOS_ASIGNADOS',
  /** Ve los proyectos donde está asignado, pero solo opera sus propias jornadas. */
  JORNADAS_ASIGNADAS = 'JORNADAS_ASIGNADAS',
}

/** De mayor a menor alcance; con varios roles gana el más amplio. */
export const ORDEN_NIVEL_ACCESO: readonly NivelAccesoRol[] = [
  NivelAccesoRol.TOTAL,
  NivelAccesoRol.TERRITORIAL,
  NivelAccesoRol.PROYECTOS_ASIGNADOS,
  NivelAccesoRol.JORNADAS_ASIGNADAS,
];
