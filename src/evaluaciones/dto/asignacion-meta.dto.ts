import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemAsignacionMetaDto {
  @ApiProperty()
  @IsUUID('4')
  usuarioId: string;

  @ApiProperty({ description: 'Cuota personal (independiente de la meta del proyecto)' })
  @IsNumber()
  @Min(0)
  cantidadAsignada: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}

export class UpsertAsignacionesMetaDto {
  @ApiProperty()
  @IsUUID('4')
  metaId: string;

  @ApiPropertyOptional({
    description: 'Periodo mensual; si se omite, cuota sobre la meta total',
  })
  @IsOptional()
  @IsUUID('4')
  metaPeriodoId?: string;

  @ApiProperty({ type: [ItemAsignacionMetaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemAsignacionMetaDto)
  asignaciones: ItemAsignacionMetaDto[];
}

export class FiltrosAsignacionMetaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  metaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  anio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mes?: number;
}

export class FiltrosProductividadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  proyectoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  anio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mes?: number;
}

export class FiltrosSugerirRepartoDto {
  @ApiProperty()
  @IsUUID('4')
  metaId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  metaPeriodoId?: string;
}
