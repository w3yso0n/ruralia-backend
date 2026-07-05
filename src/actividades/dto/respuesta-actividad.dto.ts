import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoAvanceActividad } from '../enums/estado-avance-actividad.enum';

export class RespuestaCompletadaPorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombreCompleto: string;
}

export class RespuestaSubactividadDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional()
  descripcion?: string;

  @ApiPropertyOptional()
  objetivo?: string;

  @ApiProperty()
  orden: number;

  @ApiProperty()
  estaActivo: boolean;

  @ApiProperty({ enum: EstadoAvanceActividad })
  estadoAvance: EstadoAvanceActividad;

  @ApiPropertyOptional()
  notaCompletado?: string;

  @ApiPropertyOptional()
  completadaEn?: Date;

  @ApiPropertyOptional({ type: RespuestaCompletadaPorDto })
  completadaPor?: RespuestaCompletadaPorDto;

  @ApiProperty({ description: 'Progreso de la subactividad (0-100)' })
  progresoPorcentaje: number;
}

export class RespuestaActividadDto {
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

  @ApiProperty({ enum: EstadoAvanceActividad })
  estadoAvance: EstadoAvanceActividad;

  @ApiPropertyOptional()
  notaCompletado?: string;

  @ApiPropertyOptional()
  completadaEn?: Date;

  @ApiPropertyOptional({ type: RespuestaCompletadaPorDto })
  completadaPor?: RespuestaCompletadaPorDto;

  @ApiProperty({ description: 'Progreso agregado de la actividad (0-100)' })
  progresoPorcentaje: number;

  @ApiPropertyOptional({ type: [RespuestaSubactividadDto] })
  subactividades?: RespuestaSubactividadDto[];
}

export class RespuestaPlanProyectoDto {
  @ApiProperty()
  proyectoId: string;

  @ApiProperty({ type: [RespuestaActividadDto] })
  actividades: RespuestaActividadDto[];

  @ApiProperty({ description: 'Progreso agregado del plan (0-100)' })
  progresoPorcentaje: number;
}

export class RespuestaProgresoProyectoDto {
  @ApiProperty()
  proyectoId: string;

  @ApiProperty({ description: 'Progreso agregado del plan (0-100)' })
  progresoPorcentaje: number;

  @ApiProperty()
  actividadesTotal: number;

  @ApiProperty()
  actividadesCompletadas: number;
}
