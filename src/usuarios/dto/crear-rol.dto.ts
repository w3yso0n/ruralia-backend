import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NivelAccesoRol } from '../enums/nivel-acceso-rol.enum';

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
    enum: NivelAccesoRol,
    description:
      'Proyectos que alcanza el rol: TOTAL, TERRITORIAL, PROYECTOS_ASIGNADOS o JORNADAS_ASIGNADAS',
  })
  @IsEnum(NivelAccesoRol)
  @IsOptional()
  nivelAcceso?: NivelAccesoRol;

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
