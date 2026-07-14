import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { EstadoJornada } from '../enums/estado-jornada.enum';

export class ActividadJornadaDto {
  @ApiProperty({ description: 'ID de la actividad del plan' })
  @IsUUID('4')
  actividadId: string;

  @ApiPropertyOptional({ description: 'ID de la subactividad' })
  @IsUUID('4')
  @IsOptional()
  subactividadId?: string;
}

export class CrearJornadaDto {
  @ApiProperty({ description: 'Fecha de la jornada (ISO 8601)' })
  @IsDateString()
  fecha: string;

  @ApiPropertyOptional({ description: 'Observaciones de la jornada' })
  @IsString()
  @IsOptional()
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Latitud de ubicación' })
  @IsNumber()
  @IsOptional()
  latitud?: number;

  @ApiPropertyOptional({ description: 'Longitud de ubicación' })
  @IsNumber()
  @IsOptional()
  longitud?: number;

  @ApiProperty({ description: 'ID del proyecto' })
  @IsUUID('4')
  proyectoId: string;

  @ApiPropertyOptional({
    description:
      'ID de la meta a la que aporta esta jornada (jerarquía correcta: Proyecto → Actividad → Subactividad → Proceso → Meta → Jornada)',
  })
  @IsUUID('4')
  @IsOptional()
  metaId?: string;

  @ApiPropertyOptional({
    type: [ActividadJornadaDto],
    description:
      'Actividades del plan incluidas en la jornada (modo legacy; usar metaId en lugar de esto)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActividadJornadaDto)
  @IsOptional()
  actividades?: ActividadJornadaDto[];

  @ApiProperty({ description: 'ID de la vereda' })
  @IsUUID('4')
  veredaId: string;

  @ApiPropertyOptional({ description: 'ID del técnico responsable' })
  @IsUUID('4')
  @IsOptional()
  tecnicoResponsableId?: string;
}

export class ActualizarJornadaDto {
  @ApiPropertyOptional({ description: 'Fecha de la jornada (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  fecha?: string;

  @ApiPropertyOptional({ description: 'Observaciones de la jornada' })
  @IsString()
  @IsOptional()
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Latitud de ubicación' })
  @IsNumber()
  @IsOptional()
  latitud?: number;

  @ApiPropertyOptional({ description: 'Longitud de ubicación' })
  @IsNumber()
  @IsOptional()
  longitud?: number;

  @ApiPropertyOptional({
    type: [ActividadJornadaDto],
    description: 'Reemplaza las actividades de la jornada',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActividadJornadaDto)
  @IsOptional()
  actividades?: ActividadJornadaDto[];

  @ApiPropertyOptional({ description: 'ID de la vereda' })
  @IsUUID('4')
  @IsOptional()
  veredaId?: string;
}

export class CambiarEstadoJornadaDto {
  @ApiProperty({ enum: EstadoJornada, description: 'Nuevo estado de la jornada' })
  @IsEnum(EstadoJornada)
  @IsNotEmpty()
  estado: EstadoJornada;
}

export class AgregarBeneficiariosDto {
  @ApiProperty({
    description: 'IDs de beneficiarios a agregar',
    type: [String],
  })
  @IsUUID('4', { each: true })
  beneficiarioIds: string[];
}

export class AgregarMiembroEquipoDto {
  @ApiProperty({ description: 'ID del usuario a agregar al equipo' })
  @IsUUID('4')
  usuarioId: string;
}
