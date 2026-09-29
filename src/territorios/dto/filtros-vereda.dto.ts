import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

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

  @ApiPropertyOptional({
    description: 'Si es true, solo veredas del catálogo DANE (código numérico)',
  })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  @IsOptional()
  soloDane?: boolean;
}
