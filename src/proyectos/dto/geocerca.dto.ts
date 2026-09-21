import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PuntoGeocercaDto {
  @ApiProperty({ description: 'Latitud del vértice', example: 4.570868 })
  @Expose()
  @Type(() => Number)
  @IsLatitude()
  latitud: number;

  @ApiProperty({ description: 'Longitud del vértice', example: -74.297333 })
  @Expose()
  @Type(() => Number)
  @IsLongitude()
  longitud: number;
}

export class CrearGeocercaDto {
  @ApiProperty({ description: 'Nombre de la geocerca', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción opcional' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Color hexadecimal de la zona en el mapa',
    example: '#42827A',
  })
  @IsOptional()
  @Matches(/^#([0-9A-Fa-f]{6})$/, {
    message: 'El color debe ser hexadecimal (#RRGGBB)',
  })
  color?: string;

  @ApiProperty({
    type: [PuntoGeocercaDto],
    description:
      'Vértices de la geocerca en orden (mínimo 3). El polígono se cierra solo.',
  })
  @IsArray()
  @ArrayMinSize(3, { message: 'Una geocerca necesita al menos 3 puntos' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PuntoGeocercaDto)
  puntos: PuntoGeocercaDto[];
}

export class ActualizarGeocercaDto {
  @ApiPropertyOptional({ description: 'Nombre de la geocerca', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Descripción opcional' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Color hexadecimal de la zona en el mapa',
    example: '#42827A',
  })
  @IsOptional()
  @Matches(/^#([0-9A-Fa-f]{6})$/, {
    message: 'El color debe ser hexadecimal (#RRGGBB)',
  })
  color?: string;

  @ApiPropertyOptional({
    type: [PuntoGeocercaDto],
    description: 'Vértices de la geocerca en orden (mínimo 3 si se envían)',
  })
  @IsArray()
  @ArrayMinSize(3, { message: 'Una geocerca necesita al menos 3 puntos' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PuntoGeocercaDto)
  @IsOptional()
  puntos?: PuntoGeocercaDto[];
}

export class RespuestaGeocercaDto {
  @ApiProperty({ description: 'ID de la geocerca' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'ID del proyecto al que pertenece' })
  @Expose()
  proyectoId: string;

  @ApiProperty({ description: 'Nombre de la geocerca' })
  @Expose()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción' })
  @Expose()
  descripcion?: string | null;

  @ApiProperty({ description: 'Color hexadecimal', example: '#42827A' })
  @Expose()
  color: string;

  @ApiProperty({ type: [PuntoGeocercaDto], description: 'Vértices en orden' })
  @Expose()
  @Type(() => PuntoGeocercaDto)
  puntos: PuntoGeocercaDto[];

  @ApiProperty({ description: 'Fecha de creación' })
  @Expose()
  creadoEn: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @Expose()
  actualizadoEn: Date;
}
