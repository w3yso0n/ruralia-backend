import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class FiltrosLineasProductivasDto {
  @ApiPropertyOptional({
    description: 'Texto a buscar; ignora mayúsculas y acentos',
  })
  @IsString()
  @IsOptional()
  busqueda?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limite?: number;
}

export class RenombrarLineaProductivaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;
}

export class UnificarLineasProductivasDto {
  @ApiProperty({ description: 'Línea que se conserva' })
  @IsUUID()
  destinoId: string;

  @ApiProperty({
    type: [String],
    description: 'Líneas que se juntan en la que se conserva',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  origenIds: string[];
}

export class RespuestaLineaProductivaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;
}

export class RespuestaLineaProyectoDto extends RespuestaLineaProductivaDto {
  @ApiProperty({
    description: 'Beneficiarios activos del proyecto con esta línea',
  })
  beneficiarios: number;
}

export class RespuestaLineaAdministracionDto extends RespuestaLineaProductivaDto {
  @ApiProperty({ description: 'Beneficiarios con esta línea (sin eliminados)' })
  beneficiarios: number;

  @ApiProperty({ description: 'Subactividades activas con esta línea' })
  subactividades: number;
}

export class RespuestaAdministracionLineasDto {
  @ApiProperty({ type: [RespuestaLineaAdministracionDto] })
  lineas: RespuestaLineaAdministracionDto[];

  @ApiProperty({
    description: 'Grupos de ids con nombres casi iguales; solo sugerencia',
    type: 'array',
    items: { type: 'array', items: { type: 'string' } },
  })
  posiblesDuplicados: string[][];
}

export class RespuestaUnificarLineasDto {
  @ApiProperty({ type: RespuestaLineaProductivaDto })
  linea: RespuestaLineaProductivaDto;

  @ApiProperty()
  beneficiariosActualizados: number;

  @ApiProperty()
  subactividadesActualizadas: number;
}

export class RespuestaBeneficiarioLineaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombres: string;

  @ApiProperty()
  apellidos: string;

  @ApiProperty()
  numeroDocumento: string;

  @ApiPropertyOptional({ nullable: true })
  municipio?: string | null;
}
