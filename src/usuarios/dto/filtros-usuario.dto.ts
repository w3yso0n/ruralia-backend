import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class FiltrosUsuarioDto {
  @ApiPropertyOptional({ description: 'Buscar por nombre o correo' })
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo/inactivo' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  estaActivo?: boolean;

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
