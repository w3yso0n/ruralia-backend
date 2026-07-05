import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { NombreRol } from '../enums/nombre-rol.enum';

export class RespuestaRolDto {
  @ApiProperty({ description: 'ID del rol' })
  @Expose()
  id: string;

  @ApiProperty({ enum: NombreRol, description: 'Nombre del rol asignado' })
  @Expose()
  nombre: NombreRol;

  @ApiPropertyOptional({ description: 'Descripción del rol' })
  @Expose()
  descripcion?: string;
}

export class RespuestaUsuarioDto {
  @ApiProperty({ description: 'ID del usuario' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'UID de Firebase del usuario' })
  @Expose()
  firebaseUid: string;

  @ApiProperty({ description: 'Correo electrónico del usuario' })
  @Expose()
  correo: string;

  @ApiProperty({ description: 'Nombre completo del usuario' })
  @Expose()
  nombreCompleto: string;

  @ApiPropertyOptional({ description: 'URL de la foto de perfil' })
  @Expose()
  urlFoto?: string;

  @ApiProperty({ description: 'Indica si el usuario está activo' })
  @Expose()
  estaActivo: boolean;

  @ApiProperty({ description: 'Fecha de creación del usuario' })
  @Expose()
  creadoEn: Date;

  @ApiProperty({
    type: [RespuestaRolDto],
    description: 'Roles asignados al usuario',
  })
  @Expose()
  @Type(() => RespuestaRolDto)
  roles: RespuestaRolDto[];
}

export class RespuestaPaginadaUsuariosDto {
  @ApiProperty({ type: [RespuestaUsuarioDto], description: 'Lista de usuarios' })
  @Expose()
  @Type(() => RespuestaUsuarioDto)
  datos: RespuestaUsuarioDto[];

  @ApiProperty({ description: 'Total de registros' })
  @Expose()
  total: number;

  @ApiProperty({ description: 'Página actual' })
  @Expose()
  pagina: number;

  @ApiProperty({ description: 'Cantidad de resultados por página' })
  @Expose()
  limite: number;

  @ApiProperty({ description: 'Total de páginas' })
  @Expose()
  totalPaginas: number;
}
