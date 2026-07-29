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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoJornada } from '../enums/estado-jornada.enum';
import { TipoJornada } from '../enums/tipo-jornada.enum';

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

  @ApiPropertyOptional({
    description:
      'Nombre de identificación opcional (para distinguir la jornada en listados)',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  nombre?: string;

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

  @ApiPropertyOptional({
    enum: TipoJornada,
    description:
      'INDIVIDUAL (formularios de campo) o GRUPAL (lista de asistencia). Por defecto INDIVIDUAL.',
    default: TipoJornada.INDIVIDUAL,
  })
  @IsEnum(TipoJornada)
  @IsOptional()
  tipo?: TipoJornada;

  @ApiPropertyOptional({ description: 'ID del técnico responsable' })
  @IsUUID('4')
  @IsOptional()
  tecnicoResponsableId?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'IDs de técnicos responsables (personal del proyecto). Crea una jornada independiente por cada uno, ligadas por grupoJornadaId si hay más de uno.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @IsOptional()
  tecnicoResponsableIds?: string[];
}

export class ActualizarJornadaDto {
  @ApiPropertyOptional({ description: 'Fecha de la jornada (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  fecha?: string;

  @ApiPropertyOptional({
    description:
      'Nombre de identificación opcional (cadena vacía para quitarlo)',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  nombre?: string;

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

  @ApiPropertyOptional({
    description:
      'ID de la meta a la que aporta esta jornada (necesaria para formularios en campo)',
  })
  @IsUUID('4')
  @IsOptional()
  metaId?: string;

  @ApiPropertyOptional({
    description:
      'Unidades ejecutadas en esta jornada hacia la meta (visitas, entregas, etc.)',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cantidadEjecutada?: number;

  @ApiPropertyOptional({
    enum: TipoJornada,
    description: 'INDIVIDUAL o GRUPAL',
  })
  @IsEnum(TipoJornada)
  @IsOptional()
  tipo?: TipoJornada;
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
