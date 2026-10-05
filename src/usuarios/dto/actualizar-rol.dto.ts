import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NivelAccesoRol } from '../enums/nivel-acceso-rol.enum';

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
    enum: NivelAccesoRol,
    description:
      'Proyectos que alcanza el rol: TOTAL, TERRITORIAL, PROYECTOS_ASIGNADOS o JORNADAS_ASIGNADAS',
  })
  @IsEnum(NivelAccesoRol)
  @IsOptional()
  nivelAcceso?: NivelAccesoRol;

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
