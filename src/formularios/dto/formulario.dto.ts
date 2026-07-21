import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoCampo } from '../enums/tipo-campo.enum';

export class CrearCampoFormularioDto {
  @ApiProperty({ description: 'Etiqueta visible del campo' })
  @IsString()
  @IsNotEmpty()
  etiqueta: string;

  @ApiProperty({ description: 'Clave única del campo' })
  @IsString()
  @IsNotEmpty()
  clave: string;

  @ApiProperty({ enum: TipoCampo, description: 'Tipo de campo del formulario' })
  @IsEnum(TipoCampo)
  tipoCampo: TipoCampo;

  @ApiPropertyOptional({ description: 'Opciones del campo (para selección)' })
  @IsObject()
  @IsOptional()
  opciones?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Indica si el campo es obligatorio' })
  @IsBoolean()
  @IsOptional()
  esObligatorio?: boolean;

  @ApiPropertyOptional({ description: 'Orden de visualización del campo', minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;

  @ApiPropertyOptional({ description: 'Reglas de validación del campo' })
  @IsObject()
  @IsOptional()
  reglasValidacion?: Record<string, unknown>;
}

export class CrearPlantillaFormularioDto {
  @ApiProperty({ description: 'Nombre de la plantilla' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción de la plantilla' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Versión de la plantilla', minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  version?: number;

  @ApiPropertyOptional({
    description:
      'IDs de procesos a los que se asigna la plantilla (jerarquía correcta: Proceso dentro de Subactividad)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  procesoIds?: string[];

  @ApiPropertyOptional({
    description:
      'IDs de subactividades a las que se asigna la plantilla (modo legacy; usar procesoIds)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  subactividadIds?: string[];

  @ApiPropertyOptional({
    description:
      'IDs de usuarios a los que se asigna directamente la plantilla (opcional, sin necesidad de proyecto/subactividad)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  usuarioIds?: string[];

  @ApiProperty({
    type: [CrearCampoFormularioDto],
    description: 'Campos del formulario',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearCampoFormularioDto)
  campos: CrearCampoFormularioDto[];
}

export class ActualizarCampoFormularioDto {
  @ApiPropertyOptional({ description: 'ID del campo existente (omitir si es nuevo)' })
  @IsUUID('4')
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Etiqueta visible del campo' })
  @IsString()
  @IsNotEmpty()
  etiqueta: string;

  @ApiProperty({ description: 'Clave única del campo' })
  @IsString()
  @IsNotEmpty()
  clave: string;

  @ApiProperty({ enum: TipoCampo, description: 'Tipo de campo del formulario' })
  @IsEnum(TipoCampo)
  tipoCampo: TipoCampo;

  @ApiPropertyOptional({ description: 'Opciones del campo (para selección)' })
  @IsObject()
  @IsOptional()
  opciones?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Indica si el campo es obligatorio' })
  @IsBoolean()
  @IsOptional()
  esObligatorio?: boolean;

  @ApiPropertyOptional({ description: 'Orden de visualización del campo', minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;

  @ApiPropertyOptional({ description: 'Reglas de validación del campo' })
  @IsObject()
  @IsOptional()
  reglasValidacion?: Record<string, unknown>;
}

export class ActualizarPlantillaFormularioDto {
  @ApiPropertyOptional({ description: 'Nombre de la plantilla' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Descripción de la plantilla' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({
    description:
      'IDs de procesos asignados (jerarquía correcta; reemplaza el conjunto completo)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  procesoIds?: string[];

  @ApiPropertyOptional({
    description:
      'IDs de subactividades asignadas (modo legacy; usar procesoIds)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  subactividadIds?: string[];

  @ApiPropertyOptional({
    description: 'IDs de usuarios asignados (reemplaza el conjunto completo)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  usuarioIds?: string[];

  @ApiPropertyOptional({
    type: [ActualizarCampoFormularioDto],
    description: 'Campos de la plantilla (reemplaza el conjunto completo)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActualizarCampoFormularioDto)
  @IsOptional()
  campos?: ActualizarCampoFormularioDto[];
}

export class AsignarProcesosDto {
  @ApiProperty({
    description: 'IDs de procesos a asignar (reemplaza el conjunto completo)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  procesoIds: string[];
}

export class AsignarSubactividadesDto {
  @ApiProperty({
    description: 'IDs de subactividades a asignar (modo legacy; usar procesoIds)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  subactividadIds: string[];
}

export class AsignarUsuariosDto {
  @ApiProperty({
    description: 'IDs de usuarios a asignar (reemplaza el conjunto completo)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  usuarioIds: string[];
}

export class RespuestaEnviarDto {
  @ApiProperty({ description: 'Clave del campo respondido' })
  @IsString()
  @IsNotEmpty()
  claveCampo: string;

  @ApiProperty({ description: 'Valor de la respuesta' })
  @Allow()
  valor: unknown;
}

export class EnviarFormularioDto {
  @ApiPropertyOptional({
    description:
      'ID de la jornada (opcional: se omite para formularios asignados directamente a un usuario, sin contexto de jornada)',
  })
  @IsUUID('4')
  @IsOptional()
  jornadaId?: string;

  @ApiProperty({ description: 'ID de la plantilla de formulario' })
  @IsUUID('4')
  plantillaFormularioId: string;

  @ApiProperty({
    type: [RespuestaEnviarDto],
    description: 'Respuestas del formulario',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaEnviarDto)
  respuestas: RespuestaEnviarDto[];
}

export class ActualizarEnvioFormularioDto {
  @ApiProperty({
    type: [RespuestaEnviarDto],
    description: 'Respuestas actualizadas del formulario',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaEnviarDto)
  respuestas: RespuestaEnviarDto[];
}
