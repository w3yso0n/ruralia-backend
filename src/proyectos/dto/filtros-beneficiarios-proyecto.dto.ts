import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FiltrosBeneficiariosProyectoDto {
  @ApiPropertyOptional({ description: 'Nombre, apellido o documento' })
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiPropertyOptional({ enum: ['activos', 'reemplazados'], default: 'activos' })
  @IsIn(['activos', 'reemplazados'])
  @IsOptional()
  estado?: 'activos' | 'reemplazados';

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limite?: number = 20;
}
