import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { TipoCampo } from '../enums/tipo-campo.enum';
import { TipoPlantilla } from '../enums/tipo-plantilla.enum';

export class RespuestaCampoFormularioDto {
  @ApiProperty({ description: 'ID del campo' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Etiqueta del campo' })
  @Expose()
  etiqueta: string;

  @ApiProperty({ description: 'Clave del campo' })
  @Expose()
  clave: string;

  @ApiProperty({ enum: TipoCampo, description: 'Tipo de campo' })
  @Expose()
  tipoCampo: TipoCampo;

  @ApiProperty({ description: 'Indica si el campo es obligatorio' })
  @Expose()
  esObligatorio: boolean;

  @ApiProperty({ description: 'Orden de visualización' })
  @Expose()
  orden: number;

  @ApiPropertyOptional({ description: 'Opciones del campo (para selección)' })
  @Expose()
  opciones?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Reglas de validación del campo' })
  @Expose()
  reglasValidacion?: Record<string, unknown>;
}

export class RespuestaPlantillaFormularioDto {
  @ApiProperty({ description: 'ID de la plantilla' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Nombre de la plantilla' })
  @Expose()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción de la plantilla' })
  @Expose()
  descripcion?: string;

  @ApiProperty({ description: 'Versión de la plantilla' })
  @Expose()
  version: number;

  @ApiProperty({ description: 'Indica si la plantilla está activa' })
  @Expose()
  estaActivo: boolean;

  @ApiProperty({
    enum: TipoPlantilla,
    description: 'INDIVIDUAL o GRUPAL (lista de asistencia repetible)',
  })
  @Expose()
  tipoPlantilla: TipoPlantilla;

  @ApiPropertyOptional({
    description: 'IDs de los procesos asignados a la plantilla',
    type: [String],
  })
  @Expose()
  @Transform(({ obj, value }) =>
    Array.isArray(obj.procesos)
      ? obj.procesos.map((p: { id: string }) => p.id)
      : (value ?? []),
  )
  procesoIds: string[];

  @ApiPropertyOptional({
    description: 'IDs de las subactividades asignadas a la plantilla (legacy)',
    type: [String],
  })
  @Expose()
  @Transform(({ obj, value }) =>
    Array.isArray(obj.subactividades)
      ? obj.subactividades.map((s: { id: string }) => s.id)
      : (value ?? []),
  )
  subactividadIds: string[];

  @ApiPropertyOptional({
    description: 'IDs de usuarios asignados directamente a la plantilla',
    type: [String],
  })
  @Expose()
  @Transform(({ obj, value }) =>
    Array.isArray(obj.usuarios)
      ? obj.usuarios.map((u: { id: string }) => u.id)
      : (value ?? []),
  )
  usuarioIds: string[];

  @ApiPropertyOptional({
    type: [RespuestaCampoFormularioDto],
    description: 'Campos de la plantilla',
  })
  @Expose()
  @Type(() => RespuestaCampoFormularioDto)
  campos?: RespuestaCampoFormularioDto[];
}

export class RespuestaAsignacionPlantillasProcesoDto {
  @ApiPropertyOptional({
    type: RespuestaPlantillaFormularioDto,
    description: 'Formulario individual asignado al proceso',
  })
  @Expose()
  @Type(() => RespuestaPlantillaFormularioDto)
  plantillaIndividual?: RespuestaPlantillaFormularioDto | null;

  @ApiPropertyOptional({
    type: RespuestaPlantillaFormularioDto,
    description: 'Formulario grupal (lista de asistencia) asignado al proceso',
  })
  @Expose()
  @Type(() => RespuestaPlantillaFormularioDto)
  plantillaGrupal?: RespuestaPlantillaFormularioDto | null;
}

export class RespuestaEnvioFormularioDto {
  @ApiProperty({ description: 'ID del envío' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Fecha de envío' })
  @Expose()
  enviadoEn: Date;

  @ApiPropertyOptional({ description: 'Fecha de sincronización' })
  @Expose()
  sincronizadoEn?: Date;

  @ApiProperty({ description: 'Indica si fue enviado en modo offline' })
  @Expose()
  esOffline: boolean;

  @ApiPropertyOptional({
    description: 'ID de la jornada asociada (ausente si es un envío sin jornada)',
  })
  @Expose()
  @Transform(({ obj, value }) => obj.jornada?.id ?? value)
  jornadaId?: string;

  @ApiProperty({ description: 'ID del usuario que respondió el formulario' })
  @Expose()
  @Transform(({ obj, value }) => obj.usuario?.id ?? value)
  usuarioId: string;

  @ApiPropertyOptional({ description: 'ID de la plantilla del formulario' })
  @Expose()
  @Transform(({ obj, value }) => obj.plantillaFormulario?.id ?? value)
  plantillaFormularioId?: string;

  @ApiProperty({
    description: 'Índice de fila (formularios grupales; 0 = envío único)',
  })
  @Expose()
  indiceFila: number;
}

export class RespuestaDetalleRespuestaDto {
  @ApiProperty({ description: 'ID de la respuesta' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Clave del campo' })
  @Expose()
  claveCampo: string;

  @ApiPropertyOptional({ description: 'Etiqueta del campo' })
  @Expose()
  etiquetaCampo: string;

  @ApiPropertyOptional({ enum: TipoCampo, description: 'Tipo de campo' })
  @Expose()
  tipoCampo?: TipoCampo;

  @ApiPropertyOptional({ description: 'Valor en texto' })
  @Expose()
  valorTexto?: string;

  @ApiPropertyOptional({ description: 'Valor numérico' })
  @Expose()
  valorNumero?: number;

  @ApiPropertyOptional({ description: 'Valor de fecha (YYYY-MM-DD)' })
  @Expose()
  valorFecha?: string;

  @ApiPropertyOptional({ description: 'Valor booleano' })
  @Expose()
  valorBooleano?: boolean;

  @ApiPropertyOptional({ description: 'Valor en formato JSON' })
  @Expose()
  valorJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'URL del archivo adjunto' })
  @Expose()
  urlArchivo?: string;
}

export class RespuestaEnvioPrevioDto {
  @ApiPropertyOptional({
    type: RespuestaEnvioFormularioDto,
    description: 'Último envío encontrado, o null si no hay respuestas previas',
  })
  @Expose()
  @Type(() => RespuestaEnvioFormularioDto)
  envio: RespuestaEnvioFormularioDto | null;

  @ApiProperty({
    type: [RespuestaDetalleRespuestaDto],
    description: 'Respuestas del último envío',
  })
  @Expose()
  @Type(() => RespuestaDetalleRespuestaDto)
  respuestas: RespuestaDetalleRespuestaDto[];
}
