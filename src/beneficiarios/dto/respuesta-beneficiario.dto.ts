import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Genero } from '../enums/genero.enum';
import { TipoDocumento } from '../enums/tipo-documento.enum';

export class RespuestaVeredaBeneficiarioDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  nombre: string;

  @ApiProperty()
  @Expose()
  codigo: string;
}

export class RespuestaBeneficiarioDto {
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

  @ApiPropertyOptional()
  @Expose()
  telefono?: string;

  @ApiPropertyOptional()
  @Expose()
  correo?: string;

  @ApiPropertyOptional({ enum: Genero })
  @Expose()
  genero?: Genero;

  @ApiPropertyOptional()
  @Expose()
  fechaNacimiento?: Date;

  @ApiProperty()
  @Expose()
  estaActivo: boolean;

  @ApiPropertyOptional({ type: RespuestaVeredaBeneficiarioDto })
  @Expose()
  @Type(() => RespuestaVeredaBeneficiarioDto)
  vereda?: RespuestaVeredaBeneficiarioDto;
}

export class RespuestaPaginadaBeneficiariosDto {
  @ApiProperty({ type: [RespuestaBeneficiarioDto] })
  @Expose()
  @Type(() => RespuestaBeneficiarioDto)
  datos: RespuestaBeneficiarioDto[];

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
