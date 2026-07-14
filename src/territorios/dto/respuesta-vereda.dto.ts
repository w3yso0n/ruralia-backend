import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RespuestaVeredaDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  nombre: string;

  @ApiProperty()
  @Expose()
  codigo: string;

  @ApiProperty()
  @Expose()
  estaActivo: boolean;

  @ApiPropertyOptional()
  @Expose()
  corregimientoNombre?: string;

  @ApiPropertyOptional()
  @Expose()
  municipioNombre?: string;

  @ApiPropertyOptional()
  @Expose()
  departamentoNombre?: string;

  @ApiPropertyOptional()
  @Expose()
  regionNombre?: string;
}

export class RespuestaPaginadaVeredasDto {
  @ApiProperty({ type: [RespuestaVeredaDto] })
  datos: RespuestaVeredaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  @ApiProperty()
  totalPaginas: number;
}
