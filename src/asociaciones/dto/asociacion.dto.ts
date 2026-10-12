import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TipoAsociacion } from '../enums/tipo-asociacion.enum';

export class CrearAsociacionDto {
  @ApiPropertyOptional({
    enum: TipoAsociacion,
    default: TipoAsociacion.ASOCIACION,
    description:
      'OAM es una organización que agrupa asociaciones. Puede vincularse a proyectos y jornadas igual que una asociación.',
  })
  @IsEnum(TipoAsociacion)
  @IsOptional()
  tipo?: TipoAsociacion;

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

  @ApiPropertyOptional({
    type: [String],
    description: 'IDs de beneficiarios que integran la asociación',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  beneficiarioIds?: string[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'OAM a la que pertenece esta asociación',
  })
  @IsOptional()
  @ValidateIf((_, valor) => valor !== null)
  @IsUUID('4')
  oamId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Asociaciones que agrupa, solo si el tipo es OAM',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  asociacionIds?: string[];
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

  @ApiPropertyOptional({
    type: [String],
    description: 'IDs de beneficiarios que integran la asociación',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  beneficiarioIds?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, valor) => valor !== null)
  @IsUUID('4')
  oamId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  asociacionIds?: string[];
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

  @ApiPropertyOptional({ enum: TipoAsociacion })
  @IsEnum(TipoAsociacion)
  @IsOptional()
  tipo?: TipoAsociacion;

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
