import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { NombreRol } from '../enums/nombre-rol.enum';

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ description: 'Correo electrónico del usuario' })
  @IsEmail()
  @IsOptional()
  correo?: string;

  @ApiPropertyOptional({ description: 'Nueva contraseña (mínimo 6 caracteres)' })
  @IsString()
  @MinLength(6)
  @IsOptional()
  contrasena?: string;

  @ApiPropertyOptional({ description: 'Nombre completo del usuario' })
  @IsString()
  @IsOptional()
  nombreCompleto?: string;

  @ApiPropertyOptional({ description: 'URL de la foto de perfil' })
  @IsString()
  @IsOptional()
  urlFoto?: string;

  @ApiPropertyOptional({ description: 'Indica si el usuario está activo' })
  @IsBoolean()
  @IsOptional()
  estaActivo?: boolean;

  @ApiPropertyOptional({
    enum: NombreRol,
    isArray: true,
    description: 'Roles asignados al usuario',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NombreRol, { each: true })
  @IsOptional()
  roles?: NombreRol[];
}
