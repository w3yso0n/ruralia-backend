import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ActualizarRolDto {
  @ApiPropertyOptional({ description: 'Nombre único del rol' })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  nombre?: string;

  @ApiPropertyOptional({ description: 'Descripción del rol' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Indica si el rol está activo' })
  @IsBoolean()
  @IsOptional()
  estaActivo?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'IDs de permisos (reemplaza la matriz completa)',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  permisoIds?: string[];
}
