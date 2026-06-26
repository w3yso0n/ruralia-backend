import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

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
