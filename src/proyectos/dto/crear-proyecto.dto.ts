import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TipoProyecto } from '../enums/tipo-proyecto.enum';

export class CrearProyectoDto {
  @ApiProperty({ description: 'Nombre del proyecto', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del proyecto' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ enum: TipoProyecto, description: 'Tipo de proyecto' })
  @IsEnum(TipoProyecto)
  tipo: TipoProyecto;

  @ApiPropertyOptional({ description: 'Fecha de inicio (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  fechaFin?: string;
}
