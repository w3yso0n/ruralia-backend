import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { RespuestaVeredaBeneficiarioDto } from '../../beneficiarios/dto/respuesta-beneficiario.dto';

export class RespuestaAsociacionDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  nombre: string;

  @ApiProperty()
  @Expose()
  nit: string;

  @ApiProperty()
  @Expose()
  nombreRepresentante: string;

  @ApiPropertyOptional()
  @Expose()
  telefono?: string;

  @ApiPropertyOptional()
  @Expose()
  correo?: string;

  @ApiProperty()
  @Expose()
  estaActivo: boolean;

  @ApiPropertyOptional({ type: RespuestaVeredaBeneficiarioDto })
  @Expose()
  @Type(() => RespuestaVeredaBeneficiarioDto)
  vereda?: RespuestaVeredaBeneficiarioDto;
}

export class RespuestaPaginadaAsociacionesDto {
  @ApiProperty({ type: [RespuestaAsociacionDto] })
  @Expose()
  @Type(() => RespuestaAsociacionDto)
  datos: RespuestaAsociacionDto[];

  @ApiProperty()
  @Expose()
  total: number;

  @ApiProperty()
  @Expose()
  pagina: number;

  @ApiProperty()
  @Expose()
  limite: number;

  @ApiProperty()
  @Expose()
  totalPaginas: number;
}
