import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EstadoJornada } from '../enums/estado-jornada.enum';

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

  @ApiProperty({ description: 'ID de la actividad' })
  @IsUUID('4')
  actividadId: string;

  @ApiPropertyOptional({ description: 'ID de la subactividad' })
  @IsUUID('4')
  @IsOptional()
  subactividadId?: string;

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

  @ApiPropertyOptional({ description: 'ID de la subactividad' })
  @IsUUID('4')
  @IsOptional()
  subactividadId?: string;

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
