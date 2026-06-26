import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { EstadoJornada } from '../enums/estado-jornada.enum';

export class FiltrosJornadaDto {
  @ApiPropertyOptional({ description: 'Filtrar por proyecto' })
  @IsUUID('4')
  @IsOptional()
  proyectoId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por actividad' })
  @IsUUID('4')
  @IsOptional()
  actividadId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por usuario' })
  @IsUUID('4')
  @IsOptional()
  usuarioId?: string;

  @ApiPropertyOptional({ enum: EstadoJornada, description: 'Filtrar por estado' })
  @IsEnum(EstadoJornada)
  @IsOptional()
  estado?: EstadoJornada;

  @ApiPropertyOptional({ description: 'Fecha inicial del rango (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha final del rango (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  fechaHasta?: string;

  @ApiPropertyOptional({ description: 'Número de página', default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por página',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limite?: number = 10;
}
