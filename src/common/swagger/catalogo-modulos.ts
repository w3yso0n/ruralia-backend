export interface TagModulo {
  name: string;
  description: string;
}

export const TAGS_MODULOS: TagModulo[] = [
  {
    name: 'App',
    description:
      'Punto de entrada general de la API. Expone el mensaje de bienvenida y verificación básica de disponibilidad.',
  },
  {
    name: 'Autenticación',
    description:
      'Gestión de sesión con Firebase. Permite consultar el perfil del usuario autenticado y sus roles.',
  },
  {
    name: 'Proyectos',
    description:
      'CRUD de proyectos rurales, asignación de territorios (veredas) y personal del equipo de campo.',
  },
  {
    name: 'Jornadas',
    description:
      'Jornadas de trabajo en territorio: planificación, ejecución, registro GPS y asignación de beneficiarios y equipo.',
  },
  {
    name: 'Formularios',
    description:
      'Plantillas dinámicas por subactividad, publicación de versiones y envío de respuestas durante las jornadas.',
  },
  {
    name: 'Archivos',
    description:
      'Carga de evidencias multimedia (fotos, PDF, video) asociadas a jornadas, con procesamiento asíncrono.',
  },
  {
    name: 'Sincronización',
    description:
      'Recepción de datos capturados offline desde dispositivos móviles: jornadas, formularios y evidencias.',
  },
  {
    name: 'Indicadores',
    description:
      'Definición de KPIs del proyecto y registro de valores medidos durante las jornadas de campo.',
  },
  {
    name: 'Reportes',
    description:
      'Consultas analíticas de solo lectura: resumen de proyecto, beneficiarios, avance de actividades y mapa de calor.',
  },
  {
    name: 'Salud',
    description:
      'Healthcheck de servicios críticos: base de datos PostgreSQL y cola Redis.',
  },
  {
    name: 'Usuarios',
    description:
      'Modelo de datos de usuarios y roles. Los usuarios se autentican vía Firebase; no expone CRUD directo.',
  },
  {
    name: 'Territorios',
    description:
      'Jerarquía territorial colombiana: departamento → municipio → corregimiento → vereda.',
  },
  {
    name: 'Beneficiarios',
    description:
      'Personas atendidas por los proyectos. Se vinculan a veredas y se asignan a proyectos y jornadas.',
  },
  {
    name: 'Actividades',
    description:
      'Estructura de planificación: actividades y subactividades dentro de cada proyecto.',
  },
  {
    name: 'Asociaciones',
    description:
      'Organizaciones rurales (cooperativas, asociaciones) vinculadas a veredas y proyectos.',
  },
  {
    name: 'Evidencias',
    description:
      'Metadatos de archivos multimedia capturados en jornadas. El archivo físico se sube por el módulo Archivos.',
  },
];

export const DESCRIPCION_TABLAS = `
## Modelo de datos

Catálogo de tablas de PostgreSQL gestionadas por TypeORM. Los esquemas detallados aparecen en la sección **Schemas** de esta documentación.

### Identidad y acceso

| Tabla | Descripción |
|-------|-------------|
| \`usuarios\` | Usuarios del sistema autenticados con Firebase (UID, correo, nombre, foto, estado activo). |
| \`roles\` | Roles del sistema: ADMINISTRADOR, COORDINADOR, TECNICO y VISUALIZADOR. |
| \`usuario_roles\` | Relación muchos a muchos entre usuarios y roles (control de acceso RBAC). |

### Territorio

| Tabla | Descripción |
|-------|-------------|
| \`departamentos\` | División territorial nivel 1 de Colombia (nombre y código DANE). |
| \`municipios\` | Municipios pertenecientes a un departamento. |
| \`corregimientos\` | Corregimientos o subdivisiones dentro de un municipio. |
| \`veredas\` | Veredas rurales; unidad territorial mínima donde se ejecutan los proyectos. |

### Proyecto y planificación

| Tabla | Descripción |
|-------|-------------|
| \`proyectos\` | Proyectos de desarrollo rural (nombre, tipo, estado, fechas, creador). |
| \`actividades\` | Actividades planificadas dentro de un proyecto (ordenadas y activables). |
| \`subactividades\` | Subactividades con objetivo específico, vinculadas a una actividad. |
| \`proyecto_veredas\` | Veredas asignadas al ámbito territorial de un proyecto. |
| \`proyecto_personal\` | Usuarios asignados al equipo de trabajo de un proyecto. |
| \`proyecto_beneficiarios\` | Beneficiarios inscritos o atendidos por un proyecto. |
| \`proyecto_asociaciones\` | Asociaciones rurales vinculadas a un proyecto. |

### Población objetivo

| Tabla | Descripción |
|-------|-------------|
| \`beneficiarios\` | Personas atendidas: documento, contacto, género, fecha de nacimiento y vereda de residencia. |
| \`asociaciones\` | Organizaciones con NIT, representante legal y vereda de ubicación. |

### Ejecución en campo

| Tabla | Descripción |
|-------|-------------|
| \`jornadas\` | Jornada de trabajo en territorio: fecha, estado, GPS, modo offline y sincronización. |
| \`jornada_beneficiarios\` | Beneficiarios atendidos en una jornada específica. |
| \`jornada_equipo\` | Miembros del equipo que participaron en una jornada. |
| \`evidencias\` | Metadatos de archivos (foto, PDF, video): estado de procesamiento, URLs y georreferencia. |

### Formularios dinámicos

| Tabla | Descripción |
|-------|-------------|
| \`plantillas_formulario\` | Plantilla de formulario asociada a una subactividad (con versionado). |
| \`campos_formulario\` | Campos dinámicos de una plantilla: tipo, validación JSON y orden de visualización. |
| \`envios_formulario\` | Instancia de un formulario completado durante una jornada (soporta captura offline). |
| \`respuestas_formulario\` | Valores tipados por campo de un envío (texto, número, fecha, booleano, JSON, archivo). |

### Indicadores y seguimiento

| Tabla | Descripción |
|-------|-------------|
| \`indicadores\` | KPIs del proyecto: meta, tipo (cuantitativo/cualitativo) y frecuencia de registro. |
| \`indicador_proyectos\` | Indicadores asociados a uno o más proyectos. |
| \`registros_indicador\` | Valor medido de un indicador en una jornada, registrado por un usuario. |
`;

export function construirDescripcionApi(): string {
  const modulos = TAGS_MODULOS.map(
    (tag) => `- **${tag.name}**: ${tag.description}`,
  ).join('\n');

  return [
    'API del backend **Rural-IA** para la gestión integral de proyectos de desarrollo rural en Colombia.',
    '',
    'Autenticación mediante **token JWT de Firebase** (esquema Bearer). Los endpoints marcados como públicos no requieren token.',
    '',
    '### Módulos',
    modulos,
    DESCRIPCION_TABLAS,
  ].join('\n');
}
