import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespuestaPermisoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clave: string;

  @ApiProperty()
  modulo: string;

  @ApiProperty()
  accion: string;

  @ApiPropertyOptional()
  descripcion?: string;

  @ApiProperty()
  orden: number;
}

export class RespuestaModuloPermisosDto {
  @ApiProperty()
  modulo: string;

  @ApiProperty({ type: [RespuestaPermisoDto] })
  permisos: RespuestaPermisoDto[];
}

export class RespuestaRolDetalleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional()
  descripcion?: string;

  @ApiProperty()
  esSistema: boolean;

  @ApiProperty()
  estaActivo: boolean;

  @ApiProperty({ type: [String] })
  permisoIds: string[];

  @ApiProperty({ type: [String] })
  permisoClaves: string[];

  @ApiProperty()
  conteoPermisos: number;

  @ApiProperty()
  conteoUsuarios: number;
}
