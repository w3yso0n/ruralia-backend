import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { EstadoJornada } from '../enums/estado-jornada.enum';

export class FiltrosJornadaAsignadaDto {
  @ApiPropertyOptional({ enum: EstadoJornada, description: 'Filtrar por estado' })
  @IsEnum(EstadoJornada)
  @IsOptional()
  estado?: EstadoJornada;

  @ApiPropertyOptional({ description: 'Filtrar por proyecto' })
  @IsUUID('4')
  @IsOptional()
  proyectoId?: string;

  @ApiPropertyOptional({ description: 'Número de página', default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por página',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limite?: number = 50;
}
