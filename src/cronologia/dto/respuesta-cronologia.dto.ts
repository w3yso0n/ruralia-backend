import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespuestaEventoCronologiaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  actorId: string;

  @ApiPropertyOptional()
  actorNombre?: string;

  @ApiProperty()
  proyectoId: string;

  @ApiPropertyOptional()
  proyectoNombre?: string;

  @ApiProperty()
  accion: string;

  @ApiProperty()
  entidadTipo: string;

  @ApiPropertyOptional({ nullable: true })
  entidadId: string | null;

  @ApiProperty()
  titulo: string;

  @ApiPropertyOptional({ nullable: true })
  detalle: Record<string, unknown> | null;

  @ApiProperty()
  ocurridoEn: string;
}

export class RespuestaPaginadaCronologiaDto {
  @ApiProperty({ type: [RespuestaEventoCronologiaDto] })
  datos: RespuestaEventoCronologiaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  @ApiProperty()
  totalPaginas: number;
}

export class ConteoAccionCronologiaDto {
  @ApiProperty()
  accion: string;

  @ApiProperty()
  total: number;
}

export class ConteoActorCronologiaDto {
  @ApiProperty()
  actorId: string;

  @ApiProperty()
  actorNombre: string;

  @ApiProperty()
  total: number;
}

export class ResumenCronologiaProyectoDto {
  @ApiProperty()
  proyectoId: string;

  @ApiProperty()
  totalEventos: number;

  @ApiPropertyOptional({ nullable: true })
  ultimaActividadEn: string | null;

  @ApiProperty({ type: [ConteoAccionCronologiaDto] })
  porAccion: ConteoAccionCronologiaDto[];

  @ApiProperty({ type: [ConteoActorCronologiaDto] })
  porActor: ConteoActorCronologiaDto[];
}
