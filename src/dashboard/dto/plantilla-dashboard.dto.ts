import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TamanoWidgetDashboard } from '../entities/widget-dashboard.entity';
import { ItemPreferenciaDashboardDto } from './widget-dashboard.dto';

export class ItemPlantillaDto {
  @ApiProperty()
  @IsString()
  widgetClave: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  posicion: number;

  @ApiProperty({ enum: TamanoWidgetDashboard })
  @IsEnum(TamanoWidgetDashboard)
  tamano: TamanoWidgetDashboard;

  @ApiProperty()
  @IsBoolean()
  visible: boolean;
}

export class CrearPlantillaDashboardDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiProperty({ type: [ItemPlantillaDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemPlantillaDto)
  items: ItemPlantillaDto[];
}

export class ActualizarPlantillaDashboardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional({ type: [ItemPlantillaDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemPlantillaDto)
  items?: ItemPlantillaDto[];
}

export class AsignarPlantillaRolDto {
  @ApiProperty()
  @IsString()
  rolId: string;
}

export class RolResumenDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional()
  etiqueta?: string;
}

export class PlantillaDashboardDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional()
  descripcion?: string;

  @ApiProperty({ type: [ItemPreferenciaDashboardDto] })
  items: ItemPreferenciaDashboardDto[];

  @ApiProperty({
    type: [RolResumenDto],
    description: 'Roles a los que está asignada esta plantilla actualmente',
  })
  rolesAsignados: RolResumenDto[];

  @ApiProperty()
  creadoEn: Date;

  @ApiProperty()
  actualizadoEn: Date;
}

/**
 * Permiso requerido (si aplica) resuelto en tiempo real para un widget del
 * catálogo, junto con qué roles del sistema lo cumplen ahora mismo — para
 * que el editor de plantillas muestre a quién le sirve cada widget.
 */
export class CompatibilidadRolWidgetDto {
  @ApiProperty()
  widgetClave: string;

  @ApiPropertyOptional()
  permisoRequerido?: string;

  @ApiProperty({ type: [RolResumenDto] })
  rolesCompatibles: RolResumenDto[];

  @ApiProperty({ type: [RolResumenDto] })
  rolesIncompatibles: RolResumenDto[];
}
