import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespuestaMetaPeriodoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  anio: number;

  @ApiProperty()
  mes: number;

  @ApiProperty()
  cantidadPlaneada: number;

  @ApiProperty({ description: 'Jornadas completadas en este período' })
  ejecutado: number;

  @ApiProperty({ description: 'Porcentaje de avance del período (0-100)' })
  progresoPorcentaje: number;
}

export class RespuestaMetaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  unidadMedida: string;

  @ApiProperty()
  cantidadTotal: number;

  @ApiProperty()
  orden: number;

  @ApiProperty()
  estaActivo: boolean;

  @ApiProperty({ description: 'Jornadas completadas acumuladas' })
  ejecutadoTotal: number;

  @ApiProperty({ description: 'Porcentaje de avance acumulado (0-100)' })
  progresoPorcentaje: number;

  @ApiPropertyOptional({ type: [RespuestaMetaPeriodoDto] })
  periodos?: RespuestaMetaPeriodoDto[];
}

export class RespuestaProcesoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional()
  descripcion?: string;

  @ApiProperty()
  orden: number;

  @ApiProperty()
  estaActivo: boolean;

  @ApiProperty({ description: 'Porcentaje de avance agregado del proceso (0-100)' })
  progresoPorcentaje: number;

  @ApiPropertyOptional({ type: [RespuestaMetaDto] })
  metas?: RespuestaMetaDto[];
}

export class RespuestaAvancePeriodoDto {
  @ApiProperty()
  metaId: string;

  @ApiProperty()
  metaNombre: string;

  @ApiProperty()
  unidadMedida: string;

  @ApiProperty()
  anio: number;

  @ApiProperty()
  mes: number;

  @ApiProperty()
  cantidadPlaneada: number;

  @ApiProperty()
  ejecutado: number;

  @ApiProperty()
  progresoPorcentaje: number;

  @ApiProperty()
  acumuladoTotal: number;

  @ApiProperty()
  progresoAcumulado: number;
}
