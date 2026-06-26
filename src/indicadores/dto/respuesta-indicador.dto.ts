import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FrecuenciaIndicador } from '../enums/frecuencia-indicador.enum';
import { TipoIndicador } from '../enums/tipo-indicador.enum';

export class RespuestaIndicadorDto {
  @ApiProperty({ description: 'ID del indicador' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Nombre del indicador' })
  @Expose()
  nombre: string;

  @ApiProperty({ description: 'Unidad de medida' })
  @Expose()
  unidad: string;

  @ApiPropertyOptional({ description: 'Valor meta' })
  @Expose()
  valorMeta?: number;

  @ApiProperty({ enum: TipoIndicador })
  @Expose()
  tipo: TipoIndicador;

  @ApiProperty({ enum: FrecuenciaIndicador })
  @Expose()
  frecuencia: FrecuenciaIndicador;
}

export class PuntoTendenciaDto {
  @ApiProperty({ description: 'Fecha del registro' })
  @Expose()
  registradoEn: Date;

  @ApiProperty({ description: 'Valor registrado' })
  @Expose()
  valor: number;
}

export class AvanceIndicadorDto {
  @ApiProperty({ description: 'ID del indicador' })
  @Expose()
  indicadorId: string;

  @ApiProperty({ description: 'Nombre del indicador' })
  @Expose()
  nombre: string;

  @ApiProperty({ description: 'Unidad de medida' })
  @Expose()
  unidad: string;

  @ApiPropertyOptional({ description: 'Valor meta' })
  @Expose()
  valorMeta?: number;

  @ApiProperty({ description: 'Valor actual acumulado o último' })
  @Expose()
  valorActual: number;

  @ApiProperty({ description: 'Porcentaje de avance respecto a la meta' })
  @Expose()
  porcentaje: number;

  @ApiProperty({ type: [PuntoTendenciaDto], description: 'Últimos 5 registros' })
  @Expose()
  @Type(() => PuntoTendenciaDto)
  tendencia: PuntoTendenciaDto[];
}

export class PuntoLineaTiempoDto {
  @ApiProperty({ description: 'Fecha del registro' })
  @Expose()
  registradoEn: Date;

  @ApiProperty({ description: 'Valor' })
  @Expose()
  valor: number;

  @ApiPropertyOptional({ description: 'Observaciones' })
  @Expose()
  observaciones?: string;
}

export class RespuestaRegistroIndicadorDto {
  @ApiProperty({ description: 'ID del registro' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Valor registrado' })
  @Expose()
  valor: number;

  @ApiProperty({ description: 'Fecha de registro' })
  @Expose()
  registradoEn: Date;

  @ApiPropertyOptional({ description: 'Observaciones' })
  @Expose()
  observaciones?: string;
}
