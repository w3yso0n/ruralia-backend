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

  @ApiProperty({ description: 'ID de la subactividad asociada' })
  @IsUUID('4')
  subactividadId: string;

  @ApiProperty({
    type: [CrearCampoFormularioDto],
    description: 'Campos del formulario',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearCampoFormularioDto)
  campos: CrearCampoFormularioDto[];
}

export class ClonarPlantillaDto {
  @ApiProperty({ description: 'ID de la nueva subactividad destino' })
  @IsUUID('4')
  nuevaSubactividadId: string;
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
  @ApiProperty({ description: 'ID de la jornada' })
  @IsUUID('4')
  jornadaId: string;

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
