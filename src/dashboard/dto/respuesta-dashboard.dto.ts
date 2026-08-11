import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoProyecto } from '../../proyectos/enums/estado-proyecto.enum';
import { TipoProyecto } from '../../proyectos/enums/tipo-proyecto.enum';
import { EstadoJornada } from '../../jornadas/enums/estado-jornada.enum';

export class ProyectoRecienteDashboardDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ enum: TipoProyecto })
  tipo: TipoProyecto;

  @ApiProperty({ enum: EstadoProyecto })
  estado: EstadoProyecto;

  @ApiPropertyOptional()
  progresoPorcentaje?: number;

  @ApiPropertyOptional()
  conteoBeneficiarios?: number;

  @ApiProperty()
  creadoEn: Date;

  @ApiProperty()
  actualizadoEn: Date;
}

export class ResumenDashboardDto {
  @ApiProperty()
  proyectosActivos: number;

  @ApiProperty()
  totalProyectos: number;

  @ApiProperty()
  jornadasRegistradas: number;

  @ApiProperty({
    description: 'Técnicos distintos con al menos una jornada registrada',
  })
  agentesEnCampo: number;

  @ApiProperty({ type: [ProyectoRecienteDashboardDto] })
  proyectosRecientes: ProyectoRecienteDashboardDto[];
}

export class CumplimientoDashboardDto {
  @ApiProperty({ description: 'AVG progreso del plan en proyectos ACTIVO' })
  cumplimientoPlan: number;

  @ApiProperty({
    description: 'Veredas con ≥1 jornada / veredas de proyectos ACTIVO',
  })
  coberturaTerritorial: number;

  @ApiProperty({
    description: 'Jornadas COMPLETADA con evidencia FOTO / COMPLETADAS',
  })
  jornadasConEvidencia: number;

  @ApiProperty()
  jornadasMesActual: number;
}

export class SerieMensualDashboardDto {
  @ApiProperty({ example: 'Feb' })
  mes: string;

  @ApiProperty()
  jornadas: number;

  @ApiProperty()
  formularios: number;

  @ApiProperty()
  beneficiariosAtendidos: number;
}

export class ProgresoProyectoDashboardDto {
  @ApiProperty()
  proyectoId: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ enum: TipoProyecto })
  tipo: TipoProyecto;

  @ApiProperty()
  progresoPorcentaje: number;

  @ApiProperty()
  conteoBeneficiarios: number;
}

export class ProyectoEnVeredaDto {
  @ApiProperty()
  proyectoId: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ enum: EstadoProyecto })
  estado: EstadoProyecto;

  @ApiProperty()
  progresoPorcentaje: number;

  @ApiProperty()
  beneficiarios: number;
}

export class VeredaCoberturaDto {
  @ApiProperty()
  veredaId: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  municipio: string;

  @ApiProperty()
  departamento: string;

  @ApiProperty()
  latitud: number;

  @ApiProperty()
  longitud: number;

  @ApiProperty({ type: [ProyectoEnVeredaDto] })
  proyectos: ProyectoEnVeredaDto[];
}

export class JornadaGeorefDashboardDto {
  @ApiProperty()
  jornadaId: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  latitud: number;

  @ApiProperty()
  longitud: number;

  @ApiProperty({ enum: EstadoJornada })
  estado: EstadoJornada;

  @ApiPropertyOptional()
  fecha?: string;

  @ApiProperty()
  descripcion: string;
}

export class SeguimientoCampoDashboardDto {
  @ApiProperty()
  proyectoId: string;

  @ApiProperty()
  nombreProyecto: string;

  @ApiProperty({ type: [JornadaGeorefDashboardDto] })
  jornadas: JornadaGeorefDashboardDto[];

  @ApiProperty()
  progresoAvancePorcentaje: number;
}

export class JornadaRecienteDashboardDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  proyectoNombre: string;

  @ApiProperty()
  veredaNombre: string;

  @ApiProperty()
  tecnico: string;

  @ApiProperty({ enum: EstadoJornada })
  estado: EstadoJornada;

  @ApiProperty()
  fecha: string;
}

export class DashboardCompletoDto {
  @ApiProperty({ type: ResumenDashboardDto })
  kpis: ResumenDashboardDto;

  @ApiProperty({ type: CumplimientoDashboardDto })
  medidores: CumplimientoDashboardDto;

  @ApiProperty({ type: [SerieMensualDashboardDto] })
  actividadMensual: SerieMensualDashboardDto[];

  @ApiProperty({ type: [ProgresoProyectoDashboardDto] })
  progresoProyectos: ProgresoProyectoDashboardDto[];

  @ApiProperty({ type: [VeredaCoberturaDto] })
  veredasCobertura: VeredaCoberturaDto[];

  @ApiPropertyOptional({ type: SeguimientoCampoDashboardDto })
  seguimientoDestacado: SeguimientoCampoDashboardDto | null;

  @ApiProperty({ type: [JornadaRecienteDashboardDto] })
  jornadasRecientes: JornadaRecienteDashboardDto[];
}
