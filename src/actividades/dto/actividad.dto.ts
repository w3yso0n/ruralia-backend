import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CrearActividadDto {
  @ApiProperty({ description: 'Nombre de la actividad' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción de la actividad' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Orden en el plan', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;
}

export class ActualizarActividadDto {
  @ApiPropertyOptional({ description: 'Nombre de la actividad' })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Descripción de la actividad' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Orden en el plan' })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;
}

export class CrearSubactividadDto {
  @ApiProperty({ description: 'Nombre de la subactividad' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción de la subactividad' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Objetivo de la subactividad' })
  @IsString()
  @IsOptional()
  objetivo?: string;

  @ApiPropertyOptional({ description: 'Orden dentro de la actividad', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;
}

export class ActualizarSubactividadDto {
  @ApiPropertyOptional({ description: 'Nombre de la subactividad' })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Descripción de la subactividad' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Objetivo de la subactividad' })
  @IsString()
  @IsOptional()
  objetivo?: string;

  @ApiPropertyOptional({ description: 'Orden dentro de la actividad' })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;
}

export class CompletarNodoPlanDto {
  @ApiPropertyOptional({ description: 'Nota al marcar como completada' })
  @IsString()
  @IsOptional()
  notaCompletado?: string;
}
