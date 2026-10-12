import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
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

  @ApiPropertyOptional({
    description:
      'Vereda DANE. Obligatoria al crear a mano. La carga de la matriz puede omitirla y guardar el municipio de cada fila.',
  })
  @IsUUID('4')
  @IsOptional()
  veredaId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  primerNombre?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  segundoNombre?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  primerApellido?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  segundoApellido?: string;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, valor) => valor !== null)
  @IsInt()
  @Min(0)
  @Max(130)
  edad?: number | null;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  municipio?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lineaProductiva?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nombreAsociacion?: string;
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
  primerNombre?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  segundoNombre?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  primerApellido?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  segundoApellido?: string;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, valor) => valor !== null)
  @IsInt()
  @Min(0)
  @Max(130)
  edad?: number | null;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  fechaNacimiento?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  municipio?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lineaProductiva?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nombreAsociacion?: string;
}

export enum EstadoFiltroBeneficiario {
  ACTIVOS = 'activos',
  DESACTIVADOS = 'desactivados',
}

export class FiltrosBeneficiarioDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiPropertyOptional({
    enum: EstadoFiltroBeneficiario,
    default: EstadoFiltroBeneficiario.ACTIVOS,
    description: 'Los eliminados nunca se listan',
  })
  @IsEnum(EstadoFiltroBeneficiario)
  @IsOptional()
  estado?: EstadoFiltroBeneficiario = EstadoFiltroBeneficiario.ACTIVOS;

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
