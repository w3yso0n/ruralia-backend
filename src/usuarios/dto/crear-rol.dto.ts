import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CrearRolDto {
  @ApiProperty({ description: 'Nombre único del rol' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción del rol' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'IDs de permisos a asignar',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  permisoIds?: string[];
}
