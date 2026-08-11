/** Roles de sistema sembrados; el nombre canónico no se renombra ni elimina. */
export enum RolSistema {
  CUANTIVA = 'CUANTIVA',
  ADMINISTRADOR = 'ADMINISTRADOR',
  COORDINADOR_DEPARTAMENTAL = 'COORDINADOR_DEPARTAMENTAL',
  COORDINADOR_ZONA = 'COORDINADOR_ZONA',
  CAMPO = 'CAMPO',
  VISUALIZADOR = 'VISUALIZADOR',
}

/** Alias histórico para código que aún referencia NombreRol. */
export { RolSistema as NombreRol };

/** Etiquetas legibles para UI / logs. */
export const ETIQUETAS_ROL_SISTEMA: Record<RolSistema, string> = {
  [RolSistema.CUANTIVA]: 'Cuantiva',
  [RolSistema.ADMINISTRADOR]: 'Administrador',
  [RolSistema.COORDINADOR_DEPARTAMENTAL]: 'Coordinador departamental',
  [RolSistema.COORDINADOR_ZONA]: 'Coordinador de zona',
  [RolSistema.CAMPO]: 'Campo',
  [RolSistema.VISUALIZADOR]: 'Visualizador',
};

/**
 * Renombres de roles de sistema legacy → canónicos.
 * Se aplican una vez en el seed para conservar asignaciones de usuarios.
 */
export const MIGRACION_NOMBRES_ROL_LEGACY: Record<string, RolSistema> = {
  COORDINADOR: RolSistema.COORDINADOR_DEPARTAMENTAL,
  TECNICO: RolSistema.CAMPO,
};

/** Permisos que el rol CUANTIVA no puede perder (anti-lockout). */
export const PERMISOS_CRITICOS_CUANTIVA: readonly string[] = [
  'roles.ver',
  'roles.crear',
  'roles.editar',
  'roles.eliminar',
  'usuarios.ver',
  'usuarios.editar',
  'usuarios.gestionar_roles',
] as const;

/** @deprecated usar PERMISOS_CRITICOS_CUANTIVA */
export const PERMISOS_CRITICOS_ADMIN = PERMISOS_CRITICOS_CUANTIVA;

/** Roles con bypass total de membresía de proyecto. */
export const ROLES_ACCESO_TOTAL: readonly RolSistema[] = [
  RolSistema.CUANTIVA,
  RolSistema.ADMINISTRADOR,
];

/** Roles de coordinación (gestionan si están en personal del proyecto). */
export const ROLES_COORDINACION: readonly RolSistema[] = [
  RolSistema.COORDINADOR_DEPARTAMENTAL,
  RolSistema.COORDINADOR_ZONA,
];

export interface DefinicionPermiso {
  clave: string;
  modulo: string;
  accion: string;
  descripcion: string;
  orden: number;
}

function defs(
  modulo: string,
  acciones: Array<{ accion: string; descripcion: string }>,
  ordenBase: number,
): DefinicionPermiso[] {
  return acciones.map((a, i) => ({
    clave: `${modulo}.${a.accion}`,
    modulo,
    accion: a.accion,
    descripcion: a.descripcion,
    orden: ordenBase + i,
  }));
}

export const CATALOGO_PERMISOS: DefinicionPermiso[] = [
  ...defs(
    'dashboard',
    [{ accion: 'ver', descripcion: 'Ver el panel de inicio' }],
    100,
  ),
  ...defs(
    'evaluaciones',
    [
      {
        accion: 'ver',
        descripcion:
          'Ver evaluaciones, productividad y desviaciones del equipo',
      },
      {
        accion: 'gestionar',
        descripcion: 'Asignar cuotas personales y gestionar evaluación interna',
      },
    ],
    150,
  ),
  ...defs(
    'usuarios',
    [
      { accion: 'ver', descripcion: 'Ver listado y detalle de usuarios' },
      { accion: 'crear', descripcion: 'Crear usuarios' },
      { accion: 'editar', descripcion: 'Editar usuarios' },
      { accion: 'eliminar', descripcion: 'Desactivar usuarios' },
      {
        accion: 'gestionar_roles',
        descripcion: 'Asignar roles a usuarios',
      },
    ],
    200,
  ),
  ...defs(
    'roles',
    [
      { accion: 'ver', descripcion: 'Ver roles y catálogo de permisos' },
      { accion: 'crear', descripcion: 'Crear roles personalizados' },
      { accion: 'editar', descripcion: 'Editar roles y su matriz de permisos' },
      { accion: 'eliminar', descripcion: 'Eliminar roles personalizados' },
    ],
    300,
  ),
  ...defs(
    'proyectos',
    [
      { accion: 'ver', descripcion: 'Ver proyectos' },
      { accion: 'crear', descripcion: 'Crear proyectos' },
      { accion: 'editar', descripcion: 'Editar proyectos' },
      { accion: 'eliminar', descripcion: 'Suspender / eliminar proyectos' },
      {
        accion: 'asignar_personal',
        descripcion: 'Asignar personal a proyectos',
      },
      {
        accion: 'gestionar_vinculos',
        descripcion: 'Vincular beneficiarios, asociaciones y territorios',
      },
    ],
    400,
  ),
  ...defs(
    'actividades',
    [
      { accion: 'ver', descripcion: 'Ver plan de actividades' },
      { accion: 'crear', descripcion: 'Crear actividades y subactividades' },
      { accion: 'editar', descripcion: 'Editar actividades y subactividades' },
      { accion: 'eliminar', descripcion: 'Eliminar actividades' },
      {
        accion: 'marcar_avance',
        descripcion: 'Marcar avance / completar subactividades',
      },
    ],
    500,
  ),
  ...defs(
    'contrapartes',
    [
      { accion: 'ver', descripcion: 'Ver beneficiarios y asociaciones' },
      { accion: 'crear', descripcion: 'Crear beneficiarios y asociaciones' },
      { accion: 'editar', descripcion: 'Editar beneficiarios y asociaciones' },
      {
        accion: 'eliminar',
        descripcion: 'Eliminar beneficiarios y asociaciones',
      },
    ],
    600,
  ),
  ...defs(
    'jornadas',
    [
      { accion: 'ver', descripcion: 'Ver jornadas' },
      { accion: 'crear', descripcion: 'Crear jornadas' },
      { accion: 'editar', descripcion: 'Editar jornadas' },
      { accion: 'eliminar', descripcion: 'Cancelar jornadas' },
      {
        accion: 'cambiar_estado',
        descripcion: 'Cambiar estado de ejecución de jornadas',
      },
      {
        accion: 'enviar_revision',
        descripcion: 'Enviar o reenviar jornadas a revisión',
      },
      {
        accion: 'aprobar',
        descripcion: 'Aprobar jornadas, documentos o evidencias',
      },
      {
        accion: 'rechazar',
        descripcion: 'Rechazar jornadas, documentos o evidencias',
      },
    ],
    700,
  ),
  ...defs(
    'auditoria',
    [{ accion: 'ver', descripcion: 'Consultar bitácora de auditoría' }],
    1250,
  ),
  ...defs(
    'documentos',
    [
      { accion: 'ver', descripcion: 'Ver documentos versionados' },
      {
        accion: 'versionar',
        descripcion: 'Generar nuevas versiones de documentos',
      },
    ],
    1260,
  ),
  ...defs(
    'formularios',
    [
      { accion: 'ver', descripcion: 'Ver plantillas y envíos' },
      { accion: 'crear', descripcion: 'Crear plantillas de formulario' },
      { accion: 'editar', descripcion: 'Editar plantillas' },
      { accion: 'eliminar', descripcion: 'Eliminar / despublicar plantillas' },
      { accion: 'publicar', descripcion: 'Publicar plantillas' },
      {
        accion: 'asignar_usuarios',
        descripcion: 'Asignar usuarios a plantillas',
      },
      {
        accion: 'enviar',
        descripcion: 'Enviar respuestas de formularios',
      },
    ],
    800,
  ),
  ...defs(
    'indicadores',
    [
      { accion: 'ver', descripcion: 'Ver indicadores' },
      { accion: 'crear', descripcion: 'Crear indicadores' },
      { accion: 'editar', descripcion: 'Editar indicadores' },
      { accion: 'eliminar', descripcion: 'Eliminar indicadores' },
    ],
    900,
  ),
  ...defs(
    'reportes',
    [{ accion: 'ver', descripcion: 'Ver reportes y analítica' }],
    1000,
  ),
  ...defs(
    'sincronizacion',
    [{ accion: 'usar', descripcion: 'Usar sincronización offline' }],
    1100,
  ),
  ...defs(
    'archivos',
    [
      { accion: 'subir', descripcion: 'Subir evidencias y archivos' },
      { accion: 'ver', descripcion: 'Ver evidencias y archivos' },
    ],
    1200,
  ),
  ...defs(
    'territorios',
    [
      { accion: 'ver', descripcion: 'Consultar jerarquía territorial' },
      {
        accion: 'crear',
        descripcion: 'Crear regiones, departamentos, municipios y veredas',
      },
      {
        accion: 'editar',
        descripcion: 'Editar nodos de la jerarquía territorial',
      },
      {
        accion: 'eliminar',
        descripcion: 'Desactivar nodos de la jerarquía territorial',
      },
    ],
    1300,
  ),
];

const PERMISOS_COORDINADOR_DEPARTAMENTAL: string[] = [
  'dashboard.ver',
  'evaluaciones.ver',
  'evaluaciones.gestionar',
  'usuarios.ver',
  'proyectos.ver',
  'proyectos.crear',
  'proyectos.editar',
  'proyectos.asignar_personal',
  'proyectos.gestionar_vinculos',
  'actividades.ver',
  'actividades.crear',
  'actividades.editar',
  'actividades.eliminar',
  'actividades.marcar_avance',
  'contrapartes.ver',
  'contrapartes.crear',
  'contrapartes.editar',
  'contrapartes.eliminar',
  'jornadas.ver',
  'jornadas.crear',
  'jornadas.editar',
  'jornadas.eliminar',
  'jornadas.cambiar_estado',
  'jornadas.enviar_revision',
  'jornadas.aprobar',
  'jornadas.rechazar',
  'formularios.ver',
  'formularios.asignar_usuarios',
  'formularios.enviar',
  'indicadores.ver',
  'indicadores.crear',
  'indicadores.editar',
  'indicadores.eliminar',
  'reportes.ver',
  'sincronizacion.usar',
  'archivos.subir',
  'archivos.ver',
  'auditoria.ver',
  'documentos.ver',
  'documentos.versionar',
  'territorios.ver',
  'territorios.crear',
  'territorios.editar',
  'territorios.eliminar',
];

const PERMISOS_COORDINADOR_ZONA: string[] = [
  'dashboard.ver',
  'evaluaciones.ver',
  'evaluaciones.gestionar',
  'proyectos.ver',
  'proyectos.editar',
  'proyectos.asignar_personal',
  'proyectos.gestionar_vinculos',
  'actividades.ver',
  'actividades.crear',
  'actividades.editar',
  'actividades.marcar_avance',
  'contrapartes.ver',
  'contrapartes.crear',
  'contrapartes.editar',
  'jornadas.ver',
  'jornadas.crear',
  'jornadas.editar',
  'jornadas.cambiar_estado',
  'jornadas.enviar_revision',
  'jornadas.aprobar',
  'jornadas.rechazar',
  'formularios.ver',
  'formularios.enviar',
  'formularios.asignar_usuarios',
  'indicadores.ver',
  'indicadores.crear',
  'indicadores.editar',
  'reportes.ver',
  'sincronizacion.usar',
  'archivos.subir',
  'archivos.ver',
  'auditoria.ver',
  'documentos.ver',
  'documentos.versionar',
  'territorios.ver',
];

const PERMISOS_CAMPO: string[] = [
  'dashboard.ver',
  'evaluaciones.ver',
  'proyectos.ver',
  'actividades.ver',
  'actividades.marcar_avance',
  'contrapartes.ver',
  'jornadas.ver',
  'jornadas.crear',
  'jornadas.editar',
  'jornadas.cambiar_estado',
  'jornadas.enviar_revision',
  'formularios.ver',
  'formularios.enviar',
  'indicadores.ver',
  'indicadores.crear',
  'sincronizacion.usar',
  'archivos.subir',
  'archivos.ver',
  'documentos.ver',
  'documentos.versionar',
  'territorios.ver',
];

const PERMISOS_VISUALIZADOR: string[] = [
  'dashboard.ver',
  'evaluaciones.ver',
  'proyectos.ver',
  'actividades.ver',
  'contrapartes.ver',
  'jornadas.ver',
  'formularios.ver',
  'indicadores.ver',
  'archivos.ver',
  'documentos.ver',
  'territorios.ver',
];

/** Admin operativo: casi todo, sin poder destruir el rol Cuantiva (sigue pudiendo editar roles). */
const PERMISOS_ADMINISTRADOR: string[] = CATALOGO_PERMISOS.map((p) => p.clave);

/** Permisos por defecto de cada rol de sistema (claves). */
export const PERMISOS_POR_ROL_SISTEMA: Record<RolSistema, string[] | 'ALL'> = {
  [RolSistema.CUANTIVA]: 'ALL',
  [RolSistema.ADMINISTRADOR]: PERMISOS_ADMINISTRADOR,
  [RolSistema.COORDINADOR_DEPARTAMENTAL]: PERMISOS_COORDINADOR_DEPARTAMENTAL,
  [RolSistema.COORDINADOR_ZONA]: PERMISOS_COORDINADOR_ZONA,
  [RolSistema.CAMPO]: PERMISOS_CAMPO,
  [RolSistema.VISUALIZADOR]: PERMISOS_VISUALIZADOR,
};

export const DESCRIPCIONES_ROL_SISTEMA: Record<RolSistema, string> = {
  [RolSistema.CUANTIVA]:
    'Superacceso Cuantiva: todos los permisos. No se puede eliminar ni privar de permisos críticos.',
  [RolSistema.ADMINISTRADOR]:
    'Administración operativa de la plataforma y del equipo.',
  [RolSistema.COORDINADOR_DEPARTAMENTAL]:
    'Coordinación a nivel departamental: proyectos, equipo y reportes.',
  [RolSistema.COORDINADOR_ZONA]:
    'Supervisor de zona: revisión, aprobación/rechazo y seguimiento en campo.',
  [RolSistema.CAMPO]:
    'Equipo de campo: jornadas, formularios, evidencias, avance y correcciones.',
  [RolSistema.VISUALIZADOR]: 'Solo lectura de módulos principales.',
};
