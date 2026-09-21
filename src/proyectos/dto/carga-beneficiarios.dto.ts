import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TipoDocumento } from '../../beneficiarios/enums/tipo-documento.enum';
import { RespuestaBeneficiarioResumenDto } from './respuesta-proyecto.dto';

export class ReemplazarBeneficiarioProyectoDto {
  @ApiPropertyOptional({
    description:
      'ID de un beneficiario ya existente en el catálogo. Si se omite, se crea uno nuevo con los datos de abajo.',
  })
  @IsUUID('4')
  @IsOptional()
  nuevoBeneficiarioId?: string;

  @ApiPropertyOptional({ description: 'Nombres (obligatorio si se crea uno nuevo)' })
  @ValidateIf((dto: ReemplazarBeneficiarioProyectoDto) => !dto.nuevoBeneficiarioId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombres?: string;

  @ApiPropertyOptional({ description: 'Apellidos (si no se envían se infieren del nombre)' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  apellidos?: string;

  @ApiPropertyOptional({
    description: 'Identificador único (cédula u otro documento). Obligatorio al crear.',
  })
  @ValidateIf((dto: ReemplazarBeneficiarioProyectoDto) => !dto.nuevoBeneficiarioId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  numeroDocumento?: string;

  @ApiPropertyOptional({ enum: TipoDocumento, default: TipoDocumento.CC })
  @IsEnum(TipoDocumento)
  @IsOptional()
  tipoDocumento?: TipoDocumento;

  @ApiPropertyOptional({ description: 'Motivo del reemplazo' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  nota?: string;
}

export class FilaCargaBeneficiarioDto {
  @ApiProperty()
  fila: number;

  @ApiProperty()
  identificador: string;

  @ApiProperty()
  nombres: string;

  @ApiProperty()
  apellidos: string;

  @ApiProperty({
    enum: ['creado', 'asignado_existente', 'ya_en_proyecto', 'error'],
  })
  resultado: 'creado' | 'asignado_existente' | 'ya_en_proyecto' | 'error';

  @ApiPropertyOptional()
  mensaje?: string;

  @ApiPropertyOptional()
  beneficiarioId?: string;
}

export class RespuestaCargaMasivaBeneficiariosDto {
  @ApiProperty()
  totalFilas: number;

  @ApiProperty()
  creados: number;

  @ApiProperty()
  asignadosExistentes: number;

  @ApiProperty()
  yaEnProyecto: number;

  @ApiProperty()
  errores: number;

  @ApiProperty({ type: [FilaCargaBeneficiarioDto] })
  @Type(() => FilaCargaBeneficiarioDto)
  detalle: FilaCargaBeneficiarioDto[];
}

export class EventoJornadaHistorialDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fecha: Date;

  @ApiPropertyOptional()
  nombre?: string | null;

  @ApiProperty()
  estado: string;

  @ApiPropertyOptional()
  vereda?: string;

  @ApiProperty({
    description:
      'true si el registro original era de la persona reemplazada, no del titular actual',
  })
  esHeredada: boolean;

  @ApiPropertyOptional({ type: RespuestaBeneficiarioResumenDto })
  @Type(() => RespuestaBeneficiarioResumenDto)
  beneficiarioEnRegistro?: RespuestaBeneficiarioResumenDto;
}

export class RespuestaHistorialBeneficiarioProyectoDto {
  @ApiProperty({ type: RespuestaBeneficiarioResumenDto })
  @Type(() => RespuestaBeneficiarioResumenDto)
  beneficiario: RespuestaBeneficiarioResumenDto;

  @ApiPropertyOptional({ type: RespuestaBeneficiarioResumenDto })
  @Type(() => RespuestaBeneficiarioResumenDto)
  reemplazaA?: RespuestaBeneficiarioResumenDto;

  @ApiPropertyOptional({ type: RespuestaBeneficiarioResumenDto })
  @Type(() => RespuestaBeneficiarioResumenDto)
  reemplazadoPor?: RespuestaBeneficiarioResumenDto;

  @ApiPropertyOptional()
  reemplazadoEn?: Date | null;

  @ApiPropertyOptional()
  notaReemplazo?: string | null;

  @ApiProperty({
    type: [RespuestaBeneficiarioResumenDto],
    description: 'Cadena de personas que ocuparon este cupo, de más antigua a más reciente',
  })
  @Type(() => RespuestaBeneficiarioResumenDto)
  cadenaReemplazos: RespuestaBeneficiarioResumenDto[];

  @ApiProperty({ type: [EventoJornadaHistorialDto] })
  @Type(() => EventoJornadaHistorialDto)
  jornadas: EventoJornadaHistorialDto[];
}
