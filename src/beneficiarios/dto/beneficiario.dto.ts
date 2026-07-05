import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Genero } from '../enums/genero.enum';
import { TipoDocumento } from '../enums/tipo-documento.enum';

export class CrearBeneficiarioDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @ApiProperty({ enum: TipoDocumento })
  @IsEnum(TipoDocumento)
  tipoDocumento: TipoDocumento;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  numeroDocumento: string;

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

  @ApiPropertyOptional({ enum: Genero })
  @IsEnum(Genero)
  @IsOptional()
  genero?: Genero;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;
}

export class ActualizarBeneficiarioDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nombres?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  apellidos?: string;

  @ApiPropertyOptional({ enum: TipoDocumento })
  @IsEnum(TipoDocumento)
  @IsOptional()
  tipoDocumento?: TipoDocumento;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  numeroDocumento?: string;

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

  @ApiPropertyOptional({ enum: Genero })
  @IsEnum(Genero)
  @IsOptional()
  genero?: Genero;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;
}

export class FiltrosBeneficiarioDto {
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

export class VinculoBeneficiarioProyectoDto {
  @ApiProperty()
  @IsUUID('4')
  beneficiarioId: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  esPrincipal?: boolean;
}

export class AsignarBeneficiariosProyectoDto {
  @ApiProperty({ type: [VinculoBeneficiarioProyectoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VinculoBeneficiarioProyectoDto)
  beneficiarios: VinculoBeneficiarioProyectoDto[];
}
