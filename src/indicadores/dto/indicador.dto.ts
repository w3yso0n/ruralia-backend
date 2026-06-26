import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FrecuenciaIndicador } from '../enums/frecuencia-indicador.enum';
import { TipoIndicador } from '../enums/tipo-indicador.enum';

export class CrearIndicadorDto {
  @ApiProperty({ description: 'Nombre del indicador' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ description: 'Unidad de medida (ej. personas, hectáreas)' })
  @IsString()
  @IsNotEmpty()
  unidad: string;

  @ApiPropertyOptional({ description: 'Valor meta a alcanzar' })
  @IsNumber()
  @IsOptional()
  valorMeta?: number;

  @ApiProperty({ enum: TipoIndicador, description: 'Tipo de indicador' })
  @IsEnum(TipoIndicador)
  tipo: TipoIndicador;

  @ApiProperty({ enum: FrecuenciaIndicador, description: 'Frecuencia de registro' })
  @IsEnum(FrecuenciaIndicador)
  frecuencia: FrecuenciaIndicador;

  @ApiProperty({
    description: 'IDs de proyectos a asociar',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  proyectoIds: string[];
}

export class RegistrarValorIndicadorDto {
  @ApiProperty({ description: 'Valor registrado' })
  @IsNumber()
  valor: number;

  @ApiProperty({ description: 'ID de la jornada donde se registró' })
  @IsUUID('4')
  jornadaId: string;

  @ApiPropertyOptional({ description: 'Observaciones adicionales' })
  @IsString()
  @IsOptional()
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Fecha de registro (ISO 8601)' })
  @IsOptional()
  registradoEn?: string;
}

export class RangoFechasIndicadorDto {
  @ApiPropertyOptional({ description: 'Fecha inicial del rango (ISO 8601)' })
  @IsOptional()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha final del rango (ISO 8601)' })
  @IsOptional()
  fechaHasta?: string;
}
