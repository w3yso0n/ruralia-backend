import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { EstadoProyecto } from '../enums/estado-proyecto.enum';
import { OrdenProyecto } from '../enums/orden-proyecto.enum';
import { TipoProyecto } from '../enums/tipo-proyecto.enum';

export class FiltrosProyectoDto {
  @ApiPropertyOptional({ enum: EstadoProyecto, description: 'Filtrar por estado' })
  @IsEnum(EstadoProyecto)
  @IsOptional()
  estado?: EstadoProyecto;

  @ApiPropertyOptional({ enum: TipoProyecto, description: 'Filtrar por tipo' })
  @IsEnum(TipoProyecto)
  @IsOptional()
  tipo?: TipoProyecto;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre' })
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiPropertyOptional({ description: 'Filtrar por miembro del personal' })
  @IsUUID('4')
  @IsOptional()
  personalId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por asociación vinculada' })
  @IsUUID('4')
  @IsOptional()
  asociacionId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por vereda asignada' })
  @IsUUID('4')
  @IsOptional()
  veredaId?: string;

  @ApiPropertyOptional({
    enum: OrdenProyecto,
    description: 'Orden de resultados',
    default: OrdenProyecto.CREADO_DESC,
  })
  @IsEnum(OrdenProyecto)
  @IsOptional()
  orden?: OrdenProyecto = OrdenProyecto.CREADO_DESC;

  @ApiPropertyOptional({ description: 'Número de página', default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por página',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limite?: number = 10;
}
