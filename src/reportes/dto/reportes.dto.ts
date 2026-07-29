import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class FiltrosReporteBeneficiariosDto {
  @ApiPropertyOptional({ description: 'Filtrar por vereda' })
  @IsUUID('4')
  @IsOptional()
  veredaId?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre o documento' })
  @IsString()
  @IsOptional()
  busqueda?: string;
}

export class FormatoReporteDto {
  @ApiPropertyOptional({
    description: 'Formato de salida',
    enum: ['json', 'csv'],
    default: 'json',
  })
  @IsOptional()
  formato?: 'json' | 'csv' = 'json';
}

export class FiltrosSeguimientoDiarioDto {
  @ApiPropertyOptional({ description: 'Año del mes a desglosar', example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  anio?: number;

  @ApiPropertyOptional({ description: 'Mes (1–12)', example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  mes?: number;
}
