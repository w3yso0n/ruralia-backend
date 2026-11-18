import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, ValidateIf } from 'class-validator';
import type {
  FuenteUbicacion,
  OrigenGps,
} from '../utils/ubicacion-beneficiario';

/**
 * Punto liviano de un beneficiario para el mapa de territorio.
 * La ubicación es la propia del beneficiario (su predio), no la de la vereda.
 * Los códigos DANE permiten cruzar el punto con las capas del equipo.
 */
export class PuntoTerritorioBeneficiarioDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombres: string;

  @ApiProperty()
  apellidos: string;

  @ApiProperty()
  numeroDocumento: string;

  @ApiPropertyOptional()
  lineaProductiva: string | null;

  @ApiPropertyOptional()
  nombreAsociacion: string | null;

  @ApiPropertyOptional({ description: 'Texto libre del municipio en la ficha' })
  municipioTexto: string | null;

  @ApiPropertyOptional()
  veredaId: string | null;

  @ApiPropertyOptional()
  veredaNombre: string | null;

  @ApiPropertyOptional({ description: 'Código DANE de la vereda (8 dígitos)' })
  veredaCodigo: string | null;

  @ApiPropertyOptional()
  municipioNombre: string | null;

  @ApiPropertyOptional({ description: 'Código DANE del municipio (5 dígitos)' })
  municipioCodigo: string | null;

  @ApiPropertyOptional()
  departamentoNombre: string | null;

  @ApiPropertyOptional({
    description: 'Código DANE del departamento (2 dígitos)',
  })
  departamentoCodigo: string | null;

  @ApiPropertyOptional({ description: 'Latitud propia del beneficiario' })
  latitud: number | null;

  @ApiPropertyOptional({ description: 'Longitud propia del beneficiario' })
  longitud: number | null;

  @ApiPropertyOptional({ description: 'Altitud del predio (m s. n. m.)' })
  altitud: number | null;

  @ApiPropertyOptional({ enum: ['GPS', 'MANUAL', 'EXCEL'] })
  ubicacionFuente: FuenteUbicacion | null;

  @ApiPropertyOptional({
    enum: ['GPS', 'ULTIMA_CONOCIDA', 'ULTIMA_REGISTRADA'],
  })
  ubicacionOrigenGps: OrigenGps | null;

  @ApiPropertyOptional()
  ubicacionPrecisionMetros: number | null;

  @ApiProperty({
    description: 'Una persona revisó y dio por buena la ubicación',
  })
  ubicacionConfirmada: boolean;

  @ApiPropertyOptional({
    description: 'Latitud tal como llegó del Excel (texto)',
  })
  latitudOriginal: string | null;

  @ApiPropertyOptional({
    description: 'Longitud tal como llegó del Excel (texto)',
  })
  longitudOriginal: string | null;

  @ApiPropertyOptional({
    description:
      'Ubicación de una carga que no se pudo interpretar ("lat | lng")',
  })
  ubicacionPorRevisar: string | null;

  @ApiProperty({
    type: [String],
    description:
      'Proyectos donde está activo (no cuenta reemplazados ni bajas)',
  })
  proyectoIds: string[];
}

export class ProyectoTerritorioDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  estado: string;
}

export class RespuestaTerritorioBeneficiariosDto {
  @ApiProperty({ type: [PuntoTerritorioBeneficiarioDto] })
  beneficiarios: PuntoTerritorioBeneficiarioDto[];

  @ApiProperty({
    type: [ProyectoTerritorioDto],
    description:
      'Proyectos con al menos un beneficiario activo, para el filtro',
  })
  proyectos: ProyectoTerritorioDto[];
}

/** Corrección de la ubicación propia desde la revisión de Territorio. */
export class CorregirUbicacionBeneficiarioDto {
  @ApiProperty({ description: 'Grados decimales (WGS84)' })
  @IsNumber()
  latitud: number;

  @ApiProperty({
    description: 'Grados decimales (WGS84); en Colombia es negativa',
  })
  @IsNumber()
  longitud: number;

  @ApiPropertyOptional({
    description: 'm s. n. m.; null la borra',
    nullable: true,
  })
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @IsOptional()
  altitud?: number | null;
}
