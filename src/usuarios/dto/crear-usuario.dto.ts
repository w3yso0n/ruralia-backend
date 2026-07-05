import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { NombreRol } from '../enums/nombre-rol.enum';

export class CrearUsuarioDto {
  @ApiProperty({ description: 'Correo electrónico del usuario' })
  @IsEmail()
  correo: string;

  @ApiProperty({ description: 'Contraseña inicial (mínimo 6 caracteres)' })
  @IsString()
  @MinLength(6)
  contrasena: string;

  @ApiProperty({ description: 'Nombre completo del usuario' })
  @IsString()
  @IsNotEmpty()
  nombreCompleto: string;

  @ApiPropertyOptional({ description: 'URL de la foto de perfil' })
  @IsString()
  @IsOptional()
  urlFoto?: string;

  @ApiProperty({
    enum: NombreRol,
    isArray: true,
    description: 'Roles asignados al usuario',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NombreRol, { each: true })
  roles: NombreRol[];
}
