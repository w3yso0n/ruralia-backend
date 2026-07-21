import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { EstadoEjecucionJornada } from '../enums/estado-ejecucion-jornada.enum';
import { EstadoJornada } from '../enums/estado-jornada.enum';

export class RespuestaResumenDto {
  @ApiProperty({ description: 'ID del recurso' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Nombre del recurso' })
  @Expose()
  nombre: string;
}

export class RespuestaJornadaActividadDto {
  @ApiProperty({ description: 'ID de la fila jornada-actividad' })
  @Expose()
  id: string;

  @ApiProperty({ type: RespuestaResumenDto, description: 'Actividad del plan' })
  @Expose()
  @Type(() => RespuestaResumenDto)
  actividad: RespuestaResumenDto;

  @ApiPropertyOptional({
    type: RespuestaResumenDto,
    description: 'Subactividad del plan',
  })
  @Expose()
  @Type(() => RespuestaResumenDto)
  subactividad?: RespuestaResumenDto;

  @ApiProperty({
    enum: EstadoEjecucionJornada,
    description: 'Estado de ejecución de esta actividad en la jornada',
  })
  @Expose()
  estadoEjecucion: EstadoEjecucionJornada;

  @ApiPropertyOptional({ description: 'Nota de completado' })
  @Expose()
  nota?: string;

  @ApiProperty({ description: 'Orden en la jornada' })
  @Expose()
  orden: number;
}

export class RespuestaMetaResumenDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  nombre: string;

  @ApiProperty()
  @Expose()
  unidadMedida: string;

  @ApiPropertyOptional()
  @Expose()
  procesoNombre?: string;

  @ApiPropertyOptional()
  @Expose()
  subactividadNombre?: string;

  @ApiPropertyOptional()
  @Expose()
  actividadNombre?: string;
}

export class RespuestaJornadaDto {
  @ApiProperty({ description: 'ID de la jornada' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Fecha de la jornada' })
  @Expose()
  fecha: Date;

  @ApiProperty({ enum: EstadoJornada, description: 'Estado de la jornada' })
  @Expose()
  estado: EstadoJornada;

  @ApiPropertyOptional({ description: 'Observaciones de la jornada' })
  @Expose()
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Latitud de ubicación' })
  @Expose()
  latitud?: number;

  @ApiPropertyOptional({ description: 'Longitud de ubicación' })
  @Expose()
  longitud?: number;

  @ApiProperty({ description: 'Fecha de creación' })
  @Expose()
  creadoEn: Date;

  @ApiProperty({ description: 'Indica si fue creada en modo offline' })
  @Expose()
  esOffline: boolean;

  @ApiPropertyOptional({ description: 'Fecha de sincronización' })
  @Expose()
  sincronizadoEn?: Date;

  @ApiPropertyOptional({ type: RespuestaResumenDto, description: 'Proyecto asociado' })
  @Expose()
  @Type(() => RespuestaResumenDto)
  proyecto?: RespuestaResumenDto;

  @ApiPropertyOptional({
    type: RespuestaMetaResumenDto,
    description: 'Meta a la que aporta esta jornada',
  })
  @Expose()
  @Type(() => RespuestaMetaResumenDto)
  meta?: RespuestaMetaResumenDto;

  @ApiPropertyOptional({
    type: [RespuestaJornadaActividadDto],
    description: 'Actividades incluidas en la jornada',
  })
  @Expose()
  @Type(() => RespuestaJornadaActividadDto)
  actividades?: RespuestaJornadaActividadDto[];

  @ApiPropertyOptional({ type: RespuestaResumenDto, description: 'Vereda asociada' })
  @Expose()
  @Type(() => RespuestaResumenDto)
  vereda?: RespuestaResumenDto;

  @ApiPropertyOptional({ type: RespuestaResumenDto, description: 'Técnico responsable' })
  @Expose()
  @Type(() => RespuestaResumenDto)
  tecnicoResponsable?: RespuestaResumenDto;

  @ApiPropertyOptional({
    type: [RespuestaResumenDto],
    description: 'Beneficiarios asociados a la jornada (si aplica)',
  })
  @Expose()
  @Type(() => RespuestaResumenDto)
  beneficiarios?: RespuestaResumenDto[];

  @ApiPropertyOptional({
    type: [RespuestaResumenDto],
    description: 'Equipo de la jornada',
  })
  @Expose()
  @Type(() => RespuestaResumenDto)
  equipo?: RespuestaResumenDto[];

  @ApiPropertyOptional({ description: 'Envíos de formulario asociados' })
  @Expose()
  enviosFormulario?: unknown[];

  @ApiPropertyOptional({ description: 'Evidencias asociadas' })
  @Expose()
  evidencias?: unknown[];
}

export class ResumenJornadaDto {
  @ApiProperty({ description: 'Cantidad de formularios' })
  @Expose()
  conteoFormularios: number;

  @ApiProperty({ description: 'Cantidad de evidencias' })
  @Expose()
  conteoEvidencias: number;

  @ApiProperty({ description: 'Cantidad de firmas' })
  @Expose()
  conteoFirmas: number;

  @ApiProperty({ description: 'Cantidad de beneficiarios atendidos' })
  @Expose()
  beneficiariosAtendidos: number;
}

export class RespuestaPaginadaJornadasDto {
  @ApiProperty({ type: [RespuestaJornadaDto], description: 'Lista de jornadas' })
  @Expose()
  @Type(() => RespuestaJornadaDto)
  datos: RespuestaJornadaDto[];

  @ApiProperty({ description: 'Total de registros' })
  @Expose()
  total: number;

  @ApiProperty({ description: 'Página actual' })
  @Expose()
  pagina: number;

  @ApiProperty({ description: 'Cantidad de resultados por página' })
  @Expose()
  limite: number;

  @ApiProperty({ description: 'Total de páginas' })
  @Expose()
  totalPaginas: number;
}
