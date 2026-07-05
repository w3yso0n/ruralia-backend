import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CrearAsociacionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nit: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombreRepresentante: string;

  @ApiProperty()
  @IsUUID('4')
  veredaId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  correo?: string;
}

export class ActualizarAsociacionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nombreRepresentante?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  veredaId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  correo?: string;
}

export class FiltrosAsociacionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  veredaId?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  limite?: number = 20;
}

export class VinculoAsociacionProyectoDto {
  @ApiProperty()
  @IsUUID('4')
  asociacionId: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  esPrincipal?: boolean;
}

export class AsignarAsociacionesProyectoDto {
  @ApiProperty({ type: [VinculoAsociacionProyectoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VinculoAsociacionProyectoDto)
  asociaciones: VinculoAsociacionProyectoDto[];
}
