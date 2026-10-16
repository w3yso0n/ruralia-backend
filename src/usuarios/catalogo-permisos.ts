import { NivelAccesoRol } from './enums/nivel-acceso-rol.enum';

/** Roles de sistema sembrados; el nombre canónico no se renombra ni elimina. */
export enum RolSistema {
  CUANTIVA = 'CUANTIVA',
  ADMINISTRADOR = 'ADMINISTRADOR',
  PROFESIONAL_OFICINA_PROYECTOS = 'PROFESIONAL_OFICINA_PROYECTOS',
  COORDINADOR_DEPARTAMENTAL = 'COORDINADOR_DEPARTAMENTAL',
  COORDINADOR_ZONA = 'COORDINADOR_ZONA',
  COORDINADOR_PROYECTO = 'COORDINADOR_PROYECTO',
  PROFESIONAL_APOYO = 'PROFESIONAL_APOYO',
  CAMPO = 'CAMPO',
  VISUALIZADOR = 'VISUALIZADOR',
}

/** Alias histórico para código que aún referencia NombreRol. */
export { RolSistema as NombreRol };

/** Etiquetas legibles para UI / logs. */
export const ETIQUETAS_ROL_SISTEMA: Record<RolSistema, string> = {
  [RolSistema.CUANTIVA]: 'Cuantiva',
  [RolSistema.ADMINISTRADOR]: 'Administrador',
  [RolSistema.PROFESIONAL_OFICINA_PROYECTOS]:
    'Profesional oficina de proyectos',
  [RolSistema.COORDINADOR_DEPARTAMENTAL]: 'Coordinador departamental',
  [RolSistema.COORDINADOR_ZONA]: 'Coordinador de zona',
  [RolSistema.COORDINADOR_PROYECTO]: 'Coordinador de proyecto',
  [RolSistema.PROFESIONAL_APOYO]: 'Profesional de apoyo',
  [RolSistema.CAMPO]: 'Técnico',
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

/**
 * Nivel de acceso fijo de cada rol de sistema (el seed lo reaplica en cada
 * arranque). Los roles personalizados eligen el suyo desde /roles.
 */
export const NIVEL_ACCESO_POR_ROL_SISTEMA: Record<RolSistema, NivelAccesoRol> =
  {
    [RolSistema.CUANTIVA]: NivelAccesoRol.TOTAL,
    [RolSistema.ADMINISTRADOR]: NivelAccesoRol.TOTAL,
    [RolSistema.PROFESIONAL_OFICINA_PROYECTOS]: NivelAccesoRol.TOTAL,
    [RolSistema.COORDINADOR_DEPARTAMENTAL]: NivelAccesoRol.TERRITORIAL,
    [RolSistema.COORDINADOR_ZONA]: NivelAccesoRol.TERRITORIAL,
    [RolSistema.COORDINADOR_PROYECTO]: NivelAccesoRol.PROYECTOS_ASIGNADOS,
    [RolSistema.PROFESIONAL_APOYO]: NivelAccesoRol.PROYECTOS_ASIGNADOS,
    [RolSistema.CAMPO]: NivelAccesoRol.JORNADAS_ASIGNADAS,
    [RolSistema.VISUALIZADOR]: NivelAccesoRol.PROYECTOS_ASIGNADOS,
  };

/**
 * Orden de jerarquía de roles de sistema, de mayor a menor. Se usa para
 * desempatar cuándo un usuario con varios roles tiene más de una plantilla
 * de dashboard candidata (gana la del rol de mayor jerarquía). Roles
 * personalizados (no listados aquí) se consideran de jerarquía más baja que
 * cualquier rol de sistema.
 */
export const JERARQUIA_ROLES_SISTEMA: readonly RolSistema[] = [
  RolSistema.CUANTIVA,
  RolSistema.ADMINISTRADOR,
  RolSistema.PROFESIONAL_OFICINA_PROYECTOS,
  RolSistema.COORDINADOR_DEPARTAMENTAL,
  RolSistema.COORDINADOR_ZONA,
  RolSistema.COORDINADOR_PROYECTO,
  RolSistema.PROFESIONAL_APOYO,
  RolSistema.CAMPO,
  RolSistema.VISUALIZADOR,
];

/** Índice de jerarquía de un rol por nombre; roles no listados van al final. */
export function ordenJerarquiaRol(nombreRol: string): number {
  const idx = (JERARQUIA_ROLES_SISTEMA as readonly string[]).indexOf(nombreRol);
  return idx === -1 ? JERARQUIA_ROLES_SISTEMA.length : idx;
}

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
    'configuracion',
    [
      {
        accion: 'editar_dashboard',
        descripcion: 'Personalizar los widgets del panel de inicio propio',
      },
      {
        accion: 'gestionar_plantillas',
        descripcion:
          'Crear plantillas de dashboard y asignarlas a roles para usuarios sin edición propia',
      },
    ],
    110,
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
      {
        accion: 'eliminar',
        descripcion: 'Desactivar, reactivar y eliminar usuarios',
      },
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
      {
        accion: 'configurar_aprobaciones',
        descripcion:
          'Configurar los niveles de aprobación de las jornadas del proyecto',
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
  ...defs(
    'documentos_externos',
    [
      {
        accion: 'ver',
        descripcion: 'Ver documentos externos del expediente',
      },
      {
        accion: 'crear',
        descripcion: 'Cargar y vincular documentos externos',
      },
      {
        accion: 'eliminar',
        descripcion: 'Eliminar documentos externos',
      },
    ],
    1350,
  ),
];

const PERMISOS_COORDINADOR_DEPARTAMENTAL: string[] = [
  'dashboard.ver',
  'configuracion.editar_dashboard',
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
  'documentos_externos.ver',
  'documentos_externos.crear',
  'documentos_externos.eliminar',
];

const PERMISOS_COORDINADOR_ZONA: string[] = [
  'dashboard.ver',
  'configuracion.editar_dashboard',
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
  'documentos_externos.ver',
  'documentos_externos.crear',
  'documentos_externos.eliminar',
];

/**
 * Coordinador de proyecto / Profesional de apoyo: operan solo sus proyectos
 * asignados. Crean, asignan y revisan jornadas; no crean proyectos ni
 * modifican el plan de actividades.
 */
const PERMISOS_GESTION_PROYECTO_ASIGNADO: string[] = [
  'dashboard.ver',
  'configuracion.editar_dashboard',
  'evaluaciones.ver',
  'usuarios.ver',
  'proyectos.ver',
  'proyectos.asignar_personal',
  'actividades.ver',
  'actividades.marcar_avance',
  'contrapartes.ver',
  'contrapartes.crear',
  'contrapartes.editar',
  'jornadas.ver',
  'jornadas.crear',
  'jornadas.editar',
  'jornadas.eliminar',
  'jornadas.cambiar_estado',
  'jornadas.enviar_revision',
  'jornadas.aprobar',
  'jornadas.rechazar',
  'formularios.ver',
  'formularios.enviar',
  'formularios.asignar_usuarios',
  'indicadores.ver',
  'reportes.ver',
  'sincronizacion.usar',
  'archivos.subir',
  'archivos.ver',
  'documentos.ver',
  'documentos.versionar',
  'territorios.ver',
  'documentos_externos.ver',
  'documentos_externos.crear',
];

/**
 * Tope de permisos para quien solo opera sus jornadas (Técnico). Aunque la
 * matriz del rol tenga más casillas marcadas, fuera de esta lista no aplica
 * nada: consulta sus proyectos y opera solo sus jornadas.
 */
export const PERMISOS_MAXIMOS_JORNADAS_ASIGNADAS: readonly string[] = [
  'proyectos.ver',
  'jornadas.ver',
  'jornadas.editar',
  'jornadas.cambiar_estado',
  'jornadas.enviar_revision',
  'formularios.ver',
  'formularios.enviar',
  'sincronizacion.usar',
  'archivos.subir',
  'archivos.ver',
  'documentos.ver',
  'documentos.versionar',
];

const PERMISOS_CAMPO: string[] = [...PERMISOS_MAXIMOS_JORNADAS_ASIGNADAS];

const PERMISOS_VISUALIZADOR: string[] = [
  'dashboard.ver',
  'configuracion.editar_dashboard',
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
  'documentos_externos.ver',
];

/** Admin operativo: casi todo, sin la cadena de aprobación (esa solo la tienen Admin y Cuantiva). */
const PERMISOS_OPERATIVOS: string[] = CATALOGO_PERMISOS.map((p) => p.clave).filter(
  (clave) => clave !== 'proyectos.configurar_aprobaciones',
);

const PERMISOS_ADMINISTRADOR: string[] = [
  ...PERMISOS_OPERATIVOS,
  'proyectos.configurar_aprobaciones',
];

/** Permisos por defecto de cada rol de sistema (claves). */
export const PERMISOS_POR_ROL_SISTEMA: Record<RolSistema, string[] | 'ALL'> = {
  [RolSistema.CUANTIVA]: 'ALL',
  [RolSistema.ADMINISTRADOR]: PERMISOS_ADMINISTRADOR,
  [RolSistema.PROFESIONAL_OFICINA_PROYECTOS]: PERMISOS_OPERATIVOS,
  [RolSistema.COORDINADOR_DEPARTAMENTAL]: PERMISOS_COORDINADOR_DEPARTAMENTAL,
  [RolSistema.COORDINADOR_ZONA]: PERMISOS_COORDINADOR_ZONA,
  [RolSistema.COORDINADOR_PROYECTO]: PERMISOS_GESTION_PROYECTO_ASIGNADO,
  [RolSistema.PROFESIONAL_APOYO]: PERMISOS_GESTION_PROYECTO_ASIGNADO,
  [RolSistema.CAMPO]: PERMISOS_CAMPO,
  [RolSistema.VISUALIZADOR]: PERMISOS_VISUALIZADOR,
};

export const DESCRIPCIONES_ROL_SISTEMA: Record<RolSistema, string> = {
  [RolSistema.CUANTIVA]:
    'Superacceso Cuantiva: todos los permisos. Nadie más ve este rol y no se puede eliminar.',
  [RolSistema.ADMINISTRADOR]:
    'Administración operativa de la plataforma y del equipo.',
  [RolSistema.PROFESIONAL_OFICINA_PROYECTOS]:
    'Todos los proyectos: puede crear y modificar la información de los proyectos.',
  [RolSistema.COORDINADOR_DEPARTAMENTAL]:
    'Coordinación a nivel departamental: proyectos, equipo y reportes.',
  [RolSistema.COORDINADOR_ZONA]:
    'Supervisor de zona: revisión, aprobación/rechazo y seguimiento en campo.',
  [RolSistema.COORDINADOR_PROYECTO]:
    'Proyectos asignados: puede generar, crear y asignar jornadas.',
  [RolSistema.PROFESIONAL_APOYO]:
    'Proyectos asignados: puede generar, crear y asignar jornadas.',
  [RolSistema.CAMPO]:
    'Técnico: solo tiene acceso a sus jornadas asignadas (formularios, evidencias y correcciones).',
  [RolSistema.VISUALIZADOR]: 'Solo lectura de módulos principales.',
};
