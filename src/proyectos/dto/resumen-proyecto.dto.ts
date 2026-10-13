import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MiembroMuestraResumenDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ description: 'Iniciales para el avatar' })
  iniciales: string;
}

export class RolEquipoResumenDto {
  @ApiPropertyOptional({
    description: 'ID del rol; null agrupa al personal sin rol',
    nullable: true,
    type: String,
  })
  rolId: string | null;

  @ApiProperty()
  rol: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  descripcion: string | null;

  @ApiProperty()
  total: number;

  @ApiProperty({
    type: [MiembroMuestraResumenDto],
    description: 'Hasta 4 personas del rol, ordenadas por nombre',
  })
  muestra: MiembroMuestraResumenDto[];
}

export class EquipoResumenDto {
  @ApiProperty()
  total: number;

  @ApiProperty({ type: [RolEquipoResumenDto] })
  porRol: RolEquipoResumenDto[];
}

export class MunicipioResumenDto {
  @ApiPropertyOptional({
    description: 'Nombre del municipio; null = sin municipio',
    nullable: true,
    type: String,
  })
  municipio: string | null;

  @ApiProperty()
  total: number;
}

export class ContraparteResumenDto {
  @ApiProperty()
  beneficiarios: number;

  @ApiProperty()
  asociaciones: number;

  @ApiProperty({
    type: [MunicipioResumenDto],
    description: 'Ordenado de mayor a menor; "sin municipio" al final',
  })
  porMunicipio: MunicipioResumenDto[];

  @ApiProperty({ description: 'Beneficiarios con vereda asignada' })
  conVereda: number;
}

export class ActividadesResumenDto {
  @ApiProperty()
  completadas: number;

  @ApiProperty()
  total: number;
}

export class FechasResumenDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  inicio: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  fin: string | null;
}

/** Agregados de la pestaña Resumen: nunca listas completas de personas. */
export class ResumenProyectoDto {
  @ApiProperty({ description: 'Progreso del plan (0-100)' })
  progreso: number;

  @ApiProperty()
  jornadas: number;

  @ApiProperty()
  formularios: number;

  @ApiProperty({ type: ActividadesResumenDto })
  actividades: ActividadesResumenDto;

  @ApiProperty({ type: FechasResumenDto })
  fechas: FechasResumenDto;

  @ApiProperty({ type: EquipoResumenDto })
  equipo: EquipoResumenDto;

  @ApiProperty({ type: ContraparteResumenDto })
  contraparte: ContraparteResumenDto;
}

export class FiltrosEquipoResumenDto {
  @ApiPropertyOptional({
    description: 'ID del rol principal, o "sin-rol" para personal sin rol',
  })
  @IsOptional()
  @IsString()
  rolId?: string;
}

export class MiembroEquipoResumenDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  correo: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  urlFoto: string | null;

  @ApiProperty()
  estaActivo: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  rolId: string | null;

  @ApiProperty({ description: 'Rol con el que se agrupa en el resumen' })
  rol: string;

  @ApiProperty({ type: [String] })
  otrosRoles: string[];
}
