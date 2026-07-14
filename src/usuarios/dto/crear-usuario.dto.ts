import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

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
    type: [String],
    description: 'IDs de roles asignados al usuario',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  rolIds: string[];
}
