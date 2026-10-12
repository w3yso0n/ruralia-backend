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

  @ApiPropertyOptional()
  @Expose()
  primerNombre?: string | null;

  @ApiPropertyOptional()
  @Expose()
  segundoNombre?: string | null;

  @ApiPropertyOptional()
  @Expose()
  primerApellido?: string | null;

  @ApiPropertyOptional()
  @Expose()
  segundoApellido?: string | null;

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
  edad?: number | null;

  @ApiPropertyOptional()
  @Expose()
  fechaNacimiento?: Date;

  @ApiPropertyOptional()
  @Expose()
  municipio?: string | null;

  @ApiPropertyOptional()
  @Expose()
  lineaProductiva?: string | null;

  @ApiPropertyOptional()
  @Expose()
  nombreAsociacion?: string | null;

  @ApiProperty()
  @Expose()
  estaActivo: boolean;

  @ApiPropertyOptional({ type: RespuestaVeredaBeneficiarioDto })
  @Expose()
  @Type(() => RespuestaVeredaBeneficiarioDto)
  vereda?: RespuestaVeredaBeneficiarioDto;
}

export class RespuestaUsoBeneficiarioDto {
  @ApiProperty({ description: 'Proyectos en los que está vinculado' })
  @Expose()
  proyectos: number;

  @ApiProperty({ description: 'Jornadas en las que participó' })
  @Expose()
  jornadas: number;

  @ApiProperty({ description: 'Asociaciones que lo agrupan' })
  @Expose()
  asociaciones: number;

  @ApiProperty({ description: 'Documentos del expediente ligados a él' })
  @Expose()
  documentos: number;
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
