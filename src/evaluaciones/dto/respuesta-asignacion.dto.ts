import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UsuarioAsignacionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombreCompleto: string;

  @ApiPropertyOptional()
  correo?: string;
}

export class RespuestaAsignacionMetaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  metaId: string;

  @ApiProperty()
  metaNombre: string;

  @ApiProperty()
  unidadMedida: string;

  @ApiPropertyOptional()
  metaPeriodoId?: string | null;

  @ApiPropertyOptional()
  anio?: number | null;

  @ApiPropertyOptional()
  mes?: number | null;

  @ApiProperty({ type: UsuarioAsignacionDto })
  usuario: UsuarioAsignacionDto;

  @ApiProperty()
  cantidadAsignada: number;

  @ApiProperty()
  ejecutado: number;

  @ApiProperty()
  cumplimientoPorcentaje: number;

  @ApiProperty()
  conteoJornadas: number;

  @ApiProperty()
  beneficiariosAtendidos: number;

  @ApiPropertyOptional()
  notas?: string | null;
}

export class SugerenciaRepartoDto {
  @ApiProperty({ type: UsuarioAsignacionDto })
  usuario: UsuarioAsignacionDto;

  @ApiProperty({ description: 'Jornadas ya registradas en esta meta' })
  conteoJornadas: number;

  @ApiProperty({ description: 'Propuesta equitativa editable' })
  cantidadSugerida: number;
}

export class ProductividadPersonaDto {
  @ApiProperty()
  usuarioId: string;

  @ApiProperty()
  nombreCompleto: string;

  @ApiProperty()
  cantidadAsignada: number;

  @ApiProperty()
  ejecutado: number;

  @ApiProperty()
  cumplimientoPorcentaje: number;

  @ApiProperty({
    description:
      'Índice 0–100: cumplimiento, jornadas, beneficiarios, cobertura y evidencias',
  })
  indiceEficiencia: number;

  @ApiProperty()
  conteoJornadas: number;

  @ApiProperty()
  jornadasAprobadas: number;

  @ApiProperty()
  jornadasConEvidencia: number;

  @ApiProperty()
  formulariosEnviados: number;

  @ApiProperty({
    description:
      'Veces que su trabajo de campo (jornada/formulario/evidencia) fue rechazado en revisión',
  })
  rechazosRevision: number;

  @ApiProperty()
  beneficiariosAtendidos: number;

  @ApiProperty()
  veredasCubiertas: number;

  @ApiProperty({ description: 'Beneficiarios / jornadas del periodo' })
  promedioBeneficiariosPorJornada: number;

  @ApiProperty({ description: 'Unidades ejecutadas / jornadas' })
  ritmoEjecucion: number;

  @ApiPropertyOptional()
  proyectoId?: string;

  @ApiPropertyOptional()
  proyectoNombre?: string;
}

export class ProductividadUsuarioDetalleDto {
  @ApiProperty({ type: UsuarioAsignacionDto })
  usuario: UsuarioAsignacionDto;

  @ApiProperty({ type: [RespuestaAsignacionMetaDto] })
  asignaciones: RespuestaAsignacionMetaDto[];

  @ApiProperty()
  totalAsignado: number;

  @ApiProperty()
  totalEjecutado: number;

  @ApiProperty()
  cumplimientoPromedio: number;

  @ApiProperty()
  conteoJornadas: number;

  @ApiProperty()
  beneficiariosAtendidos: number;

  @ApiProperty()
  veredasCubiertas: number;

  @ApiProperty({
    description:
      'Veces rechazado en revisión (jornada, formulario/documento o evidencia)',
  })
  rechazosRevision: number;
}

/** Desviaciones vs planeación (base para fallos / incumplimientos del mes). */
export class DesviacionMetaDto {
  @ApiProperty()
  metaId: string;

  @ApiProperty()
  metaNombre: string;

  @ApiProperty()
  unidadMedida: string;

  @ApiPropertyOptional()
  proyectoId?: string;

  @ApiPropertyOptional()
  proyectoNombre?: string;

  @ApiProperty()
  cantidadAsignada: number;

  @ApiProperty()
  ejecutado: number;

  @ApiProperty()
  cumplimientoPorcentaje: number;

  @ApiProperty({
    description: 'true si no hubo ejecución con cuota > 0',
  })
  sinEjecucion: boolean;

  @ApiProperty({
    description: 'true si cumplimiento < 100 con cuota > 0',
  })
  incumplida: boolean;
}

export class ResumenDesviacionesDto {
  @ApiProperty({ type: UsuarioAsignacionDto })
  usuario: UsuarioAsignacionDto;

  @ApiProperty()
  anio: number;

  @ApiProperty()
  mes: number;

  @ApiProperty()
  metasConCuota: number;

  @ApiProperty({ description: 'Cuotas con ejecutado = 0' })
  fallosSinEjecucion: number;

  @ApiProperty({ description: 'Cuotas con cumplimiento < 100%' })
  incumplimientos: number;

  @ApiProperty({ type: [DesviacionMetaDto] })
  detalle: DesviacionMetaDto[];
}
