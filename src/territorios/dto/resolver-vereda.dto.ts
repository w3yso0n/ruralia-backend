import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ResolverVeredaDto {
  @ApiProperty({ description: 'Nombre de la vereda o localidad rural' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombreVereda: string;

  @ApiPropertyOptional({ description: 'Municipio' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  municipio?: string;

  @ApiPropertyOptional({ description: 'Departamento' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  departamento?: string;

  @ApiPropertyOptional({ description: 'Corregimiento (opcional)' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  corregimiento?: string;

  @ApiPropertyOptional({ description: 'Place ID de Google Maps' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  placeId?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitud?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  longitud?: number;
}
