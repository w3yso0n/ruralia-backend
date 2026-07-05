import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { EstadoProyecto } from '../enums/estado-proyecto.enum';
import { TipoProyecto } from '../enums/tipo-proyecto.enum';
import { RespuestaUsuarioResumenDto } from './respuesta-usuario-resumen.dto';
import { RespuestaVeredaResumenDto } from './respuesta-vereda-resumen.dto';

export class RespuestaActividadResumenDto {
  @ApiProperty({ description: 'ID de la actividad' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Nombre de la actividad' })
  @Expose()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción de la actividad' })
  @Expose()
  descripcion?: string;

  @ApiProperty({ description: 'Orden de la actividad' })
  @Expose()
  orden: number;

  @ApiProperty({ description: 'Indica si la actividad está activa' })
  @Expose()
  estaActivo: boolean;
}

export class RespuestaBeneficiarioResumenDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  nombres: string;

  @ApiProperty()
  @Expose()
  apellidos: string;
}

export class RespuestaAsociacionResumenDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  nombre: string;
}

export class RespuestaProyectoDto {
  @ApiProperty({ description: 'ID del proyecto' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Nombre del proyecto' })
  @Expose()
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del proyecto' })
  @Expose()
  descripcion?: string;

  @ApiProperty({ enum: TipoProyecto, description: 'Tipo de proyecto' })
  @Expose()
  tipo: TipoProyecto;

  @ApiProperty({ enum: EstadoProyecto, description: 'Estado del proyecto' })
  @Expose()
  estado: EstadoProyecto;

  @ApiPropertyOptional({ description: 'Fecha de inicio del proyecto' })
  @Expose()
  fechaInicio?: Date;

  @ApiPropertyOptional({ description: 'Fecha de fin del proyecto' })
  @Expose()
  fechaFin?: Date;

  @ApiProperty({ description: 'Fecha de creación' })
  @Expose()
  creadoEn: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @Expose()
  actualizadoEn: Date;

  @ApiPropertyOptional({ type: RespuestaUsuarioResumenDto, description: 'Usuario creador' })
  @Expose()
  @Type(() => RespuestaUsuarioResumenDto)
  creador?: RespuestaUsuarioResumenDto;

  @ApiPropertyOptional({
    type: [RespuestaActividadResumenDto],
    description: 'Actividades del proyecto',
  })
  @Expose()
  @Type(() => RespuestaActividadResumenDto)
  actividades?: RespuestaActividadResumenDto[];

  @ApiPropertyOptional({
    type: [RespuestaVeredaResumenDto],
    description: 'Veredas asignadas al proyecto',
  })
  @Expose()
  @Type(() => RespuestaVeredaResumenDto)
  veredas?: RespuestaVeredaResumenDto[];

  @ApiPropertyOptional({
    type: [RespuestaUsuarioResumenDto],
    description: 'Personal asignado al proyecto',
  })
  @Expose()
  @Type(() => RespuestaUsuarioResumenDto)
  personal?: RespuestaUsuarioResumenDto[];

  @ApiPropertyOptional({ description: 'Cantidad de beneficiarios del proyecto' })
  @Expose()
  conteoBeneficiarios?: number;

  @ApiPropertyOptional({ description: 'Progreso del plan (0-100)' })
  @Expose()
  progresoPorcentaje?: number;

  @ApiPropertyOptional({
    type: RespuestaBeneficiarioResumenDto,
    description: 'Beneficiario principal del proyecto',
  })
  @Expose()
  @Type(() => RespuestaBeneficiarioResumenDto)
  beneficiarioPrincipal?: RespuestaBeneficiarioResumenDto;

  @ApiPropertyOptional({
    type: [RespuestaBeneficiarioResumenDto],
    description: 'Beneficiarios vinculados al proyecto',
  })
  @Expose()
  @Type(() => RespuestaBeneficiarioResumenDto)
  beneficiarios?: RespuestaBeneficiarioResumenDto[];

  @ApiPropertyOptional({
    type: RespuestaAsociacionResumenDto,
    description: 'Asociación principal del proyecto',
  })
  @Expose()
  @Type(() => RespuestaAsociacionResumenDto)
  asociacionPrincipal?: RespuestaAsociacionResumenDto;

  @ApiPropertyOptional({
    type: [RespuestaAsociacionResumenDto],
    description: 'Asociaciones vinculadas al proyecto',
  })
  @Expose()
  @Type(() => RespuestaAsociacionResumenDto)
  asociaciones?: RespuestaAsociacionResumenDto[];
}

export class RespuestaPaginadaProyectosDto {
  @ApiProperty({ type: [RespuestaProyectoDto], description: 'Lista de proyectos' })
  @Expose()
  @Type(() => RespuestaProyectoDto)
  datos: RespuestaProyectoDto[];

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

export class EstadisticasProyectoDto {
  @ApiProperty({ description: 'Cantidad de beneficiarios' })
  @Expose()
  conteoBeneficiarios: number;

  @ApiProperty({ description: 'Cantidad de jornadas' })
  @Expose()
  conteoJornadas: number;

  @ApiProperty({ description: 'Cantidad de formularios enviados' })
  @Expose()
  conteoFormulariosEnviados: number;

  @ApiProperty({ description: 'Porcentaje de avance de indicadores' })
  @Expose()
  porcentajeAvanceIndicadores: number;
}
