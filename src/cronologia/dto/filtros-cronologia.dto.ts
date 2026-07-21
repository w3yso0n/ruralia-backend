import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ACCIONES_CRONOLOGIA } from '../tipos-cronologia';

export class FiltrosCronologiaDto {
  @ApiPropertyOptional({ description: 'Número de página', default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({
    description: 'Resultados por página',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limite?: number = 20;

  @ApiPropertyOptional({ description: 'Filtrar por actor (modo proyecto)' })
  @IsUUID('4')
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por código de acción',
    enum: ACCIONES_CRONOLOGIA,
  })
  @IsIn([...ACCIONES_CRONOLOGIA])
  @IsOptional()
  accion?: string;

  @ApiPropertyOptional({ description: 'Desde (ISO 8601 inclusive)' })
  @IsDateString()
  @IsOptional()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Hasta (ISO 8601 inclusive)' })
  @IsDateString()
  @IsOptional()
  fechaHasta?: string;
}
