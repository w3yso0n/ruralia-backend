import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDecimal,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CrearProcesoDto {
  @ApiProperty({ description: 'Nombre del proceso' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del proceso' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Orden dentro de la subactividad', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;
}

export class ActualizarProcesoDto {
  @ApiPropertyOptional({ description: 'Nombre del proceso' })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Descripción del proceso' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Orden dentro de la subactividad' })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;
}

export class CrearMetaDto {
  @ApiProperty({ description: 'Nombre de la meta' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ description: 'Unidad de medida (visitas, entregas, muestras, etc.)' })
  @IsString()
  @IsNotEmpty()
  unidadMedida: string;

  @ApiProperty({ description: 'Cantidad total planeada para toda la vida del proceso' })
  @IsNumber()
  @Min(0)
  cantidadTotal: number;

  @ApiPropertyOptional({ description: 'Orden dentro del proceso', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;
}

export class ActualizarMetaDto {
  @ApiPropertyOptional({ description: 'Nombre de la meta' })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Unidad de medida' })
  @IsString()
  @IsOptional()
  unidadMedida?: string;

  @ApiPropertyOptional({ description: 'Cantidad total planeada' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cantidadTotal?: number;

  @ApiPropertyOptional({ description: 'Orden dentro del proceso' })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;
}

export class CrearMetaPeriodoDto {
  @ApiProperty({ description: 'Año del período (ej: 2025)' })
  @IsInt()
  @Min(2000)
  anio: number;

  @ApiProperty({ description: 'Mes del período (1-12)' })
  @IsInt()
  @Min(1)
  mes: number;

  @ApiProperty({ description: 'Cantidad planeada para este mes' })
  @IsNumber()
  @Min(0)
  cantidadPlaneada: number;
}

export class ActualizarMetaPeriodoDto {
  @ApiPropertyOptional({ description: 'Cantidad planeada para este mes' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cantidadPlaneada?: number;
}
