import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

function vacioAUndefinido({ value }: { value: unknown }) {
  return value === '' || value == null ? undefined : value;
}

export class FiltrosDashboardDto {
  @ApiPropertyOptional({
    description:
      'Si se envía, todas las métricas se calculan solo para este proyecto',
  })
  @Transform(vacioAUndefinido)
  @IsOptional()
  @IsUUID('4')
  proyectoId?: string;

  @ApiPropertyOptional({ default: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(24)
  meses?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limite?: number;
}
