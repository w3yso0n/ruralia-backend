import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoDocumento } from '../../beneficiarios/enums/tipo-documento.enum';

/** Estado de la línea base de un beneficiario en un proyecto (derivado de su última jornada de línea base). */
export enum EstadoLineaBase {
  SIN_ASIGNAR = 'SIN_ASIGNAR',
  ASIGNADA = 'ASIGNADA',
  ENVIADA = 'ENVIADA',
  EN_CORRECCION = 'EN_CORRECCION',
  COMPLETA = 'COMPLETA',
}

export class ConfigurarLineaBaseDto {
  @ApiProperty({
    description:
      'Formulario de línea base del proyecto (publicado). null para quitarlo. Solo afecta a las jornadas nuevas.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  plantillaFormularioId: string | null;
}

export class AltaRapidaBeneficiarioDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombres: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  apellidos: string;

  @ApiProperty({ description: 'Número de documento (cédula)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  numeroDocumento: string;

  @ApiPropertyOptional({ enum: TipoDocumento, default: TipoDocumento.CC })
  @IsOptional()
  @IsEnum(TipoDocumento)
  tipoDocumento?: TipoDocumento;
}

export class AsignarLineaBaseDto {
  @ApiProperty({ type: [String], description: 'Beneficiarios del proyecto' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @IsUUID('4', { each: true })
  beneficiarioIds: string[];

  @ApiProperty({ description: 'Técnico del personal del proyecto' })
  @IsUUID('4')
  tecnicoId: string;

  @ApiPropertyOptional({
    description: 'Fecha prevista (YYYY-MM-DD). Por defecto, hoy.',
  })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}

export class FiltrosBeneficiariosLineaBaseDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number;

  @ApiPropertyOptional({ enum: EstadoLineaBase })
  @IsOptional()
  @IsIn(Object.values(EstadoLineaBase))
  estado?: EstadoLineaBase;

  @ApiPropertyOptional({ description: 'Nombre o documento' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busqueda?: string;
}

export class ResumenLineaBaseDto {
  @ApiProperty() total: number;
  @ApiProperty() sinAsignar: number;
  @ApiProperty() asignada: number;
  @ApiProperty() enviada: number;
  @ApiProperty() enCorreccion: number;
  @ApiProperty() completa: number;
}

export class PlantillaLineaBaseDto {
  @ApiProperty() id: string;
  @ApiProperty() nombre: string;
  @ApiProperty() version: number;
  @ApiProperty() estaActivo: boolean;
  @ApiProperty() cantidadPreguntas: number;
}

export class EstadoLineaBaseProyectoDto {
  @ApiPropertyOptional({ type: PlantillaLineaBaseDto, nullable: true })
  plantilla: PlantillaLineaBaseDto | null;

  @ApiProperty({ type: ResumenLineaBaseDto })
  resumen: ResumenLineaBaseDto;
}

export class TerritorioFilaLineaBaseDto {
  @ApiPropertyOptional() region?: string | null;
  @ApiPropertyOptional() departamento?: string | null;
  @ApiPropertyOptional() municipio?: string | null;
  @ApiPropertyOptional() veredaDane?: string | null;
  @ApiPropertyOptional() veredaPdet?: string | null;
}

export class FilaBeneficiarioLineaBaseDto {
  @ApiProperty() beneficiarioId: string;
  @ApiProperty() nombreCompleto: string;
  @ApiProperty() numeroDocumento: string;
  @ApiProperty() tipoDocumento: string;
  @ApiPropertyOptional() lineaProductiva?: string | null;
  @ApiProperty({ type: TerritorioFilaLineaBaseDto })
  territorio: TerritorioFilaLineaBaseDto;
  @ApiProperty({ enum: EstadoLineaBase }) estado: EstadoLineaBase;
  @ApiPropertyOptional() jornadaId?: string | null;
  @ApiPropertyOptional() fecha?: string | null;
  @ApiPropertyOptional() tecnico?: string | null;
  @ApiPropertyOptional() enviadoEn?: Date | null;
}

export class PaginaBeneficiariosLineaBaseDto {
  @ApiProperty({ type: [FilaBeneficiarioLineaBaseDto] })
  datos: FilaBeneficiarioLineaBaseDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;
}

export class ResultadoAsignacionLineaBaseDto {
  @ApiProperty() creadas: number;
  @ApiPropertyOptional() grupoJornadaId: string | null;
  @ApiProperty({ type: [String] }) jornadaIds: string[];
}
