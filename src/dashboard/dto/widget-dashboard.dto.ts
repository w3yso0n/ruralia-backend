import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  TamanoWidgetDashboard,
  TipoWidgetDashboard,
} from '../entities/widget-dashboard.entity';

export class WidgetDisponibleDto {
  @ApiProperty()
  clave: string;

  @ApiProperty()
  titulo: string;

  @ApiPropertyOptional()
  descripcion?: string;

  @ApiProperty({ enum: TipoWidgetDashboard })
  tipo: TipoWidgetDashboard;

  @ApiProperty({ enum: TamanoWidgetDashboard, isArray: true })
  tamanosPermitidos: TamanoWidgetDashboard[];

  @ApiProperty({ enum: TamanoWidgetDashboard })
  tamanoPorDefecto: TamanoWidgetDashboard;
}

export class ItemPreferenciaDashboardDto {
  @ApiProperty()
  widgetClave: string;

  @ApiProperty()
  posicion: number;

  @ApiProperty({ enum: TamanoWidgetDashboard })
  tamano: TamanoWidgetDashboard;

  @ApiProperty()
  visible: boolean;
}

export class ConfiguracionDashboardDto {
  @ApiProperty({ type: [ItemPreferenciaDashboardDto] })
  items: ItemPreferenciaDashboardDto[];

  @ApiProperty({
    description:
      'true si el usuario nunca guardó configuración propia (layout de fábrica)',
  })
  esPorDefecto: boolean;
}

export class ItemActualizarPreferenciaDto {
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

export class ActualizarConfiguracionDashboardDto {
  @ApiProperty({ type: [ItemActualizarPreferenciaDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemActualizarPreferenciaDto)
  items: ItemActualizarPreferenciaDto[];
}
