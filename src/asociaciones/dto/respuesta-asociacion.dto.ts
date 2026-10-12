import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { RespuestaVeredaBeneficiarioDto } from '../../beneficiarios/dto/respuesta-beneficiario.dto';
import { TipoDocumento } from '../../beneficiarios/enums/tipo-documento.enum';
import { TipoAsociacion } from '../enums/tipo-asociacion.enum';

export class RespuestaOrganizacionResumenDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  nombre: string;

  @ApiPropertyOptional()
  @Expose()
  nit?: string;
}

export class RespuestaBeneficiarioAsociacionDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  nombres: string;

  @ApiProperty()
  @Expose()
  apellidos: string;

  @ApiProperty({ enum: TipoDocumento })
  @Expose()
  tipoDocumento: TipoDocumento;

  @ApiProperty()
  @Expose()
  numeroDocumento: string;

  @ApiPropertyOptional({ type: RespuestaVeredaBeneficiarioDto })
  @Expose()
  @Type(() => RespuestaVeredaBeneficiarioDto)
  vereda?: RespuestaVeredaBeneficiarioDto;
}

export class RespuestaAsociacionDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty({ enum: TipoAsociacion })
  @Expose()
  tipo: TipoAsociacion;

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

  @ApiPropertyOptional({ type: RespuestaOrganizacionResumenDto })
  @Expose()
  @Type(() => RespuestaOrganizacionResumenDto)
  oam?: RespuestaOrganizacionResumenDto | null;

  @ApiPropertyOptional({ description: 'Asociaciones agrupadas cuando es una OAM' })
  @Expose()
  totalAsociaciones?: number;

  @ApiPropertyOptional({ type: [RespuestaOrganizacionResumenDto] })
  @Expose()
  @Type(() => RespuestaOrganizacionResumenDto)
  asociaciones?: RespuestaOrganizacionResumenDto[];

  @ApiPropertyOptional({ description: 'Cantidad de beneficiarios activos agrupados' })
  @Expose()
  totalBeneficiarios?: number;

  @ApiPropertyOptional({
    type: [RespuestaBeneficiarioAsociacionDto],
    description: 'Solo se incluye al consultar una asociación por ID',
  })
  @Expose()
  @Type(() => RespuestaBeneficiarioAsociacionDto)
  beneficiarios?: RespuestaBeneficiarioAsociacionDto[];
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
