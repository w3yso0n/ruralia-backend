import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

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
    type: [String],
    description: 'IDs de roles asignados al usuario',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  rolIds?: string[];
}
