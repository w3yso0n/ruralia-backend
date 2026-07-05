import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FiltrosVeredaDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre o código' })
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiPropertyOptional({ description: 'Filtrar por municipio' })
  @IsUUID('4')
  @IsOptional()
  municipioId?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @Type(() => Number)
  @IsOptional()
  limite?: number = 50;
}
