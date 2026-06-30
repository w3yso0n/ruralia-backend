import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({
  name: 'usuarios',
  description:
    'Usuarios del sistema autenticados vía Firebase. Almacena el UID de Firebase, correo, nombre completo y estado activo.',
})
export class TablaUsuarios {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'UID único asignado por Firebase Authentication' })
  firebaseUid: string;

  @ApiProperty({ description: 'Correo electrónico del usuario' })
  correo: string;

  @ApiProperty({ description: 'Nombre completo del usuario' })
  nombreCompleto: string;

  @ApiPropertyOptional({ description: 'URL de la foto de perfil' })
  urlFoto?: string;

  @ApiProperty({ description: 'Indica si el usuario está activo en el sistema' })
  estaActivo: boolean;

  @ApiProperty({ description: 'Fecha de creación del registro' })
  creadoEn: Date;
}

@ApiSchema({
  name: 'roles',
  description:
    'Roles del sistema para control de acceso: ADMINISTRADOR, COORDINADOR, TECNICO y VISUALIZADOR.',
})
export class TablaRoles {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({
    description: 'Nombre del rol',
    enum: ['ADMINISTRADOR', 'COORDINADOR', 'TECNICO', 'VISUALIZADOR'],
  })
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del rol y sus permisos' })
  descripcion?: string;
}

@ApiSchema({
  name: 'usuario_roles',
  description:
    'Tabla de unión muchos a muchos entre usuarios y roles. Define qué permisos tiene cada usuario.',
})
export class TablaUsuarioRoles {
  @ApiProperty({ description: 'ID del usuario' })
  usuarioId: string;

  @ApiProperty({ description: 'ID del rol asignado' })
  rolId: string;
}

@ApiSchema({
  name: 'departamentos',
  description:
    'División territorial de primer nivel en Colombia. Contiene el nombre y código DANE del departamento.',
})
export class TablaDepartamentos {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre del departamento' })
  nombre: string;

  @ApiProperty({ description: 'Código DANE único del departamento' })
  codigo: string;

  @ApiProperty({ description: 'Indica si el departamento está activo' })
  estaActivo: boolean;
}

@ApiSchema({
  name: 'municipios',
  description: 'Municipios de Colombia. Cada municipio pertenece a un departamento.',
})
export class TablaMunicipios {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre del municipio' })
  nombre: string;

  @ApiProperty({ description: 'Código DANE único del municipio' })
  codigo: string;

  @ApiProperty({ description: 'ID del departamento al que pertenece' })
  departamentoId: string;
}

@ApiSchema({
  name: 'corregimientos',
  description:
    'Corregimientos o subdivisiones administrativas dentro de un municipio.',
})
export class TablaCorregimientos {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre del corregimiento' })
  nombre: string;

  @ApiProperty({ description: 'Código único del corregimiento' })
  codigo: string;

  @ApiProperty({ description: 'ID del municipio al que pertenece' })
  municipioId: string;
}

@ApiSchema({
  name: 'veredas',
  description:
    'Veredas rurales: unidad territorial mínima donde se ejecutan jornadas y se ubican beneficiarios.',
})
export class TablaVeredas {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre de la vereda' })
  nombre: string;

  @ApiProperty({ description: 'Código único de la vereda' })
  codigo: string;

  @ApiProperty({ description: 'ID del corregimiento al que pertenece' })
  corregimientoId: string;
}

@ApiSchema({
  name: 'proyectos',
  description:
    'Proyectos de desarrollo rural. Agrupa actividades, territorios, personal, beneficiarios e indicadores.',
})
export class TablaProyectos {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre del proyecto' })
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción detallada del proyecto' })
  descripcion?: string;

  @ApiProperty({ description: 'Tipo de proyecto (extensión, capacitación, etc.)' })
  tipo: string;

  @ApiProperty({ description: 'Estado actual: BORRADOR, ACTIVO, SUSPENDIDO, FINALIZADO' })
  estado: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio del proyecto' })
  fechaInicio?: Date;

  @ApiPropertyOptional({ description: 'Fecha de finalización del proyecto' })
  fechaFin?: Date;

  @ApiProperty({ description: 'ID del usuario que creó el proyecto' })
  creadorId: string;
}

@ApiSchema({
  name: 'actividades',
  description:
    'Actividades planificadas dentro de un proyecto. Se organizan por orden y pueden activarse o desactivarse.',
})
export class TablaActividades {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre de la actividad' })
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción de la actividad' })
  descripcion?: string;

  @ApiProperty({ description: 'Orden de visualización dentro del proyecto' })
  orden: number;

  @ApiProperty({ description: 'ID del proyecto al que pertenece' })
  proyectoId: string;
}

@ApiSchema({
  name: 'subactividades',
  description:
    'Subactividades con objetivo específico. Cada una puede tener plantillas de formulario asociadas.',
})
export class TablaSubactividades {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre de la subactividad' })
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción de la subactividad' })
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Objetivo medible de la subactividad' })
  objetivo?: string;

  @ApiProperty({ description: 'ID de la actividad padre' })
  actividadId: string;
}

@ApiSchema({
  name: 'proyecto_veredas',
  description:
    'Tabla de unión que asigna las veredas al ámbito territorial de un proyecto.',
})
export class TablaProyectoVeredas {
  @ApiProperty({ description: 'ID del proyecto' })
  proyectoId: string;

  @ApiProperty({ description: 'ID de la vereda asignada' })
  veredaId: string;
}

@ApiSchema({
  name: 'proyecto_personal',
  description:
    'Tabla de unión que asigna usuarios (técnicos, coordinadores) al equipo de un proyecto.',
})
export class TablaProyectoPersonal {
  @ApiProperty({ description: 'ID del proyecto' })
  proyectoId: string;

  @ApiProperty({ description: 'ID del usuario asignado' })
  usuarioId: string;
}

@ApiSchema({
  name: 'proyecto_beneficiarios',
  description:
    'Tabla de unión que vincula beneficiarios inscritos o atendidos por un proyecto.',
})
export class TablaProyectoBeneficiarios {
  @ApiProperty({ description: 'ID del proyecto' })
  proyectoId: string;

  @ApiProperty({ description: 'ID del beneficiario' })
  beneficiarioId: string;
}

@ApiSchema({
  name: 'proyecto_asociaciones',
  description:
    'Tabla de unión que vincula asociaciones rurales participantes en un proyecto.',
})
export class TablaProyectoAsociaciones {
  @ApiProperty({ description: 'ID del proyecto' })
  proyectoId: string;

  @ApiProperty({ description: 'ID de la asociación' })
  asociacionId: string;
}

@ApiSchema({
  name: 'beneficiarios',
  description:
    'Personas atendidas por los proyectos. Registra datos de identificación, contacto y vereda de residencia.',
})
export class TablaBeneficiarios {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombres del beneficiario' })
  nombres: string;

  @ApiProperty({ description: 'Apellidos del beneficiario' })
  apellidos: string;

  @ApiProperty({ description: 'Tipo de documento de identidad' })
  tipoDocumento: string;

  @ApiProperty({ description: 'Número de documento único' })
  numeroDocumento: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto' })
  telefono?: string;

  @ApiProperty({ description: 'ID de la vereda de residencia' })
  veredaId: string;
}

@ApiSchema({
  name: 'asociaciones',
  description:
    'Organizaciones rurales (cooperativas, asociaciones de productores) con NIT y representante legal.',
})
export class TablaAsociaciones {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre de la asociación' })
  nombre: string;

  @ApiProperty({ description: 'NIT único de la organización' })
  nit: string;

  @ApiProperty({ description: 'Nombre del representante legal' })
  nombreRepresentante: string;

  @ApiProperty({ description: 'ID de la vereda donde está ubicada' })
  veredaId: string;
}

@ApiSchema({
  name: 'jornadas',
  description:
    'Jornada de trabajo en territorio. Registra fecha, estado, ubicación GPS y soporte para captura offline.',
})
export class TablaJornadas {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Fecha de la jornada' })
  fecha: Date;

  @ApiProperty({
    description: 'Estado: PLANIFICADA, EN_CURSO, COMPLETADA, CANCELADA',
  })
  estado: string;

  @ApiPropertyOptional({ description: 'Latitud GPS de la jornada' })
  latitud?: number;

  @ApiPropertyOptional({ description: 'Longitud GPS de la jornada' })
  longitud?: number;

  @ApiProperty({ description: 'Indica si fue creada en modo offline' })
  esOffline: boolean;

  @ApiProperty({ description: 'ID del proyecto' })
  proyectoId: string;

  @ApiProperty({ description: 'ID de la vereda donde se realizó' })
  veredaId: string;
}

@ApiSchema({
  name: 'jornada_beneficiarios',
  description:
    'Tabla de unión que registra qué beneficiarios fueron atendidos en cada jornada.',
})
export class TablaJornadaBeneficiarios {
  @ApiProperty({ description: 'ID de la jornada' })
  jornadaId: string;

  @ApiProperty({ description: 'ID del beneficiario atendido' })
  beneficiarioId: string;
}

@ApiSchema({
  name: 'jornada_equipo',
  description:
    'Tabla de unión que registra los miembros del equipo que participaron en una jornada.',
})
export class TablaJornadaEquipo {
  @ApiProperty({ description: 'ID de la jornada' })
  jornadaId: string;

  @ApiProperty({ description: 'ID del usuario del equipo' })
  usuarioId: string;
}

@ApiSchema({
  name: 'evidencias',
  description:
    'Metadatos de archivos multimedia capturados en jornadas: fotos, PDFs y videos con georreferencia y estado de procesamiento.',
})
export class TablaEvidencias {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Tipo: FOTO, PDF, VIDEO, FIRMA' })
  tipo: string;

  @ApiProperty({
    description:
      'Estado de procesamiento: PENDIENTE_ARCHIVO, EN_COLA, PROCESANDO, COMPLETADO, ERROR',
  })
  estado: string;

  @ApiPropertyOptional({ description: 'URL del archivo procesado' })
  urlArchivo?: string;

  @ApiProperty({ description: 'Nombre original del archivo' })
  nombreArchivo: string;

  @ApiProperty({ description: 'ID de la jornada asociada' })
  jornadaId: string;
}

@ApiSchema({
  name: 'plantillas_formulario',
  description:
    'Plantilla de formulario dinámico asociada a una subactividad. Soporta versionado y publicación.',
})
export class TablaPlantillasFormulario {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre de la plantilla' })
  nombre: string;

  @ApiProperty({ description: 'Número de versión de la plantilla' })
  version: number;

  @ApiProperty({ description: 'Indica si la plantilla está activa y publicada' })
  estaActivo: boolean;

  @ApiProperty({ description: 'ID de la subactividad asociada' })
  subactividadId: string;
}

@ApiSchema({
  name: 'campos_formulario',
  description:
    'Campos dinámicos de una plantilla: tipo (texto, número, selección, etc.), validación JSON y orden.',
})
export class TablaCamposFormulario {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Etiqueta visible del campo' })
  etiqueta: string;

  @ApiProperty({ description: 'Clave única del campo dentro de la plantilla' })
  clave: string;

  @ApiProperty({ description: 'Tipo de campo del formulario' })
  tipoCampo: string;

  @ApiProperty({ description: 'Indica si el campo es obligatorio' })
  esObligatorio: boolean;

  @ApiProperty({ description: 'ID de la plantilla a la que pertenece' })
  plantillaFormularioId: string;
}

@ApiSchema({
  name: 'envios_formulario',
  description:
    'Instancia de un formulario completado durante una jornada. Soporta captura offline y sincronización posterior.',
})
export class TablaEnviosFormulario {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Fecha y hora en que se envió el formulario' })
  enviadoEn: Date;

  @ApiProperty({ description: 'Indica si fue capturado en modo offline' })
  esOffline: boolean;

  @ApiProperty({ description: 'ID de la jornada donde se completó' })
  jornadaId: string;

  @ApiProperty({ description: 'ID de la plantilla utilizada' })
  plantillaFormularioId: string;
}

@ApiSchema({
  name: 'respuestas_formulario',
  description:
    'Valores respondidos por campo en un envío de formulario. Almacena el valor en el tipo de dato correspondiente.',
})
export class TablaRespuestasFormulario {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Clave del campo respondido' })
  claveCampo: string;

  @ApiPropertyOptional({ description: 'Valor en texto' })
  valorTexto?: string;

  @ApiPropertyOptional({ description: 'Valor numérico' })
  valorNumero?: number;

  @ApiProperty({ description: 'ID del envío al que pertenece' })
  envioFormularioId: string;
}

@ApiSchema({
  name: 'indicadores',
  description:
    'Indicadores de gestión (KPIs) con meta, tipo cuantitativo/cualitativo y frecuencia de medición.',
})
export class TablaIndicadores {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Nombre del indicador' })
  nombre: string;

  @ApiProperty({ description: 'Unidad de medida (personas, hectáreas, etc.)' })
  unidad: string;

  @ApiPropertyOptional({ description: 'Valor meta a alcanzar' })
  valorMeta?: number;

  @ApiProperty({ description: 'Tipo: CUANTITATIVO o CUALITATIVO' })
  tipo: string;
}

@ApiSchema({
  name: 'indicador_proyectos',
  description:
    'Tabla de unión que asocia indicadores a uno o más proyectos para seguimiento de avance.',
})
export class TablaIndicadorProyectos {
  @ApiProperty({ description: 'ID del indicador' })
  indicadorId: string;

  @ApiProperty({ description: 'ID del proyecto' })
  proyectoId: string;
}

@ApiSchema({
  name: 'registros_indicador',
  description:
    'Valor medido de un indicador durante una jornada, registrado por un usuario del equipo.',
})
export class TablaRegistrosIndicador {
  @ApiProperty({ description: 'Identificador único (UUID)' })
  id: string;

  @ApiProperty({ description: 'Valor registrado del indicador' })
  valor: number;

  @ApiProperty({ description: 'Fecha y hora del registro' })
  registradoEn: Date;

  @ApiProperty({ description: 'ID del indicador medido' })
  indicadorId: string;

  @ApiProperty({ description: 'ID de la jornada donde se registró' })
  jornadaId: string;
}

export const ESQUEMAS_TABLAS = [
  TablaUsuarios,
  TablaRoles,
  TablaUsuarioRoles,
  TablaDepartamentos,
  TablaMunicipios,
  TablaCorregimientos,
  TablaVeredas,
  TablaProyectos,
  TablaActividades,
  TablaSubactividades,
  TablaProyectoVeredas,
  TablaProyectoPersonal,
  TablaProyectoBeneficiarios,
  TablaProyectoAsociaciones,
  TablaBeneficiarios,
  TablaAsociaciones,
  TablaJornadas,
  TablaJornadaBeneficiarios,
  TablaJornadaEquipo,
  TablaEvidencias,
  TablaPlantillasFormulario,
  TablaCamposFormulario,
  TablaEnviosFormulario,
  TablaRespuestasFormulario,
  TablaIndicadores,
  TablaIndicadorProyectos,
  TablaRegistrosIndicador,
];
