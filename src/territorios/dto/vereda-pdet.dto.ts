import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Campos del catálogo PDET que se pueden mapear desde una columna del archivo. */
export const CAMPOS_MAPEO_PDET = [
  { campo: 'codigo', etiqueta: 'Código de la vereda PDET', obligatorio: false },
  { campo: 'nombre', etiqueta: 'Nombre de la vereda PDET', obligatorio: true },
  {
    campo: 'municipioCodigo',
    etiqueta: 'Código DANE del municipio',
    obligatorio: false,
  },
  { campo: 'municipio', etiqueta: 'Nombre del municipio', obligatorio: false },
  { campo: 'departamento', etiqueta: 'Departamento', obligatorio: false },
  { campo: 'subregion', etiqueta: 'Subregión PDET', obligatorio: false },
  {
    campo: 'veredaDaneCodigo',
    etiqueta: 'Código de la vereda DANE equivalente',
    obligatorio: false,
  },
] as const;

export type CampoMapeoPdet = (typeof CAMPOS_MAPEO_PDET)[number]['campo'];

/** Columna (1 = A) de cada campo. Se exige nombre y municipio (código o nombre). */
export interface MapeoVeredasPdet {
  filaEncabezado: number;
  columnas: Partial<Record<CampoMapeoPdet, number>>;
}

const CAMPOS_VALIDOS = new Set<string>(CAMPOS_MAPEO_PDET.map((c) => c.campo));

/** Valida el mapeo que llega como texto JSON en el formulario multipart. */
export function leerMapeoPdet(entrada: unknown): MapeoVeredasPdet {
  let valor: unknown = entrada;
  if (typeof entrada === 'string') {
    try {
      valor = JSON.parse(entrada);
    } catch {
      valor = null;
    }
  }
  const invalido = () => new Error('mapeo');
  if (!valor || typeof valor !== 'object') throw invalido();
  const { filaEncabezado, columnas } = valor as Record<string, unknown>;
  if (!Number.isInteger(filaEncabezado) || (filaEncabezado as number) < 1) {
    throw invalido();
  }
  if (!columnas || typeof columnas !== 'object') throw invalido();
  const limpias: Partial<Record<CampoMapeoPdet, number>> = {};
  for (const [campo, columna] of Object.entries(columnas)) {
    if (!CAMPOS_VALIDOS.has(campo)) continue;
    if (columna == null) continue;
    if (
      !Number.isInteger(columna) ||
      (columna as number) < 1 ||
      (columna as number) > 500
    ) {
      throw invalido();
    }
    limpias[campo as CampoMapeoPdet] = columna as number;
  }
  return { filaEncabezado: filaEncabezado as number, columnas: limpias };
}

export class FiltrosVeredaPdetDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') municipioId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') departamentoId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busqueda?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  incluirInactivas?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limite?: number;
}

export class CrearVeredaPdetDto {
  @ApiProperty() @IsUUID('4') municipioId: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(60) codigo: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) nombre: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subregion?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  veredaDaneId?: string | null;
}

export class ActualizarVeredaPdetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subregion?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  veredaDaneId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() estaActivo?: boolean;
}

export class CatalogoVeredasPdetDto {
  @ApiPropertyOptional({ description: 'Solo los municipios del proyecto' })
  @IsOptional()
  @IsUUID('4')
  proyectoId?: string;
}
