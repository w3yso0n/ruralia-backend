import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { TipoEvidencia } from '../../evidencias/enums/tipo-evidencia.enum';
import { EstadoJornada } from '../../jornadas/enums/estado-jornada.enum';

export class RespuestaFormularioOfflineDto {
  @ApiProperty({ description: 'Clave del campo respondido' })
  @IsString()
  @IsNotEmpty()
  claveCampo: string;

  @ApiProperty({ description: 'ID del campo del formulario' })
  @IsUUID('4')
  campoFormularioId: string;

  @ApiPropertyOptional({ description: 'Valor en texto' })
  @IsString()
  @IsOptional()
  valorTexto?: string;

  @ApiPropertyOptional({ description: 'Valor numérico' })
  @IsNumber()
  @IsOptional()
  valorNumero?: number;

  @ApiPropertyOptional({ description: 'Valor de fecha (ISO 8601)' })
  @IsISO8601()
  @IsOptional()
  valorFecha?: string;

  @ApiPropertyOptional({ description: 'Valor booleano' })
  @IsBoolean()
  @IsOptional()
  valorBooleano?: boolean;

  @ApiPropertyOptional({ description: 'Valor en formato JSON' })
  @IsObject()
  @IsOptional()
  valorJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'URL del archivo adjunto' })
  @IsString()
  @IsOptional()
  urlArchivo?: string;
}

export class EnvioFormularioOfflineDto {
  @ApiProperty({ description: 'ID local del envío en el dispositivo' })
  @IsString()
  @IsNotEmpty()
  idLocal: string;

  @ApiProperty({ description: 'ID local de la jornada en el dispositivo' })
  @IsString()
  @IsNotEmpty()
  jornadaIdLocal: string;

  @ApiProperty({ description: 'ID de la plantilla de formulario' })
  @IsUUID('4')
  plantillaFormularioId: string;

  @ApiProperty({ description: 'Fecha de envío (ISO 8601)' })
  @IsISO8601()
  enviadoEn: string;

  @ApiPropertyOptional({ description: 'Datos sin procesar del formulario' })
  @IsObject()
  @IsOptional()
  datosRaw?: Record<string, unknown>;

  @ApiProperty({
    type: [RespuestaFormularioOfflineDto],
    description: 'Respuestas del formulario',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaFormularioOfflineDto)
  respuestas: RespuestaFormularioOfflineDto[];
}

export class ActividadJornadaOfflineDto {
  @ApiProperty({ description: 'ID de la actividad' })
  @IsUUID('4')
  actividadId: string;

  @ApiPropertyOptional({ description: 'ID de la subactividad' })
  @IsUUID('4')
  @IsOptional()
  subactividadId?: string;
}

export class JornadaOfflineDto {
  @ApiProperty({ description: 'ID local de la jornada en el dispositivo' })
  @IsString()
  @IsNotEmpty()
  idLocal: string;

  @ApiProperty({ description: 'Fecha de la jornada (ISO 8601)' })
  @IsDateString()
  fecha: string;

  @ApiProperty({ enum: EstadoJornada, description: 'Estado de la jornada' })
  @IsEnum(EstadoJornada)
  estado: EstadoJornada;

  @ApiPropertyOptional({ description: 'Observaciones de la jornada' })
  @IsString()
  @IsOptional()
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Latitud de ubicación' })
  @IsNumber()
  @IsOptional()
  latitud?: number;

  @ApiPropertyOptional({ description: 'Longitud de ubicación' })
  @IsNumber()
  @IsOptional()
  longitud?: number;

  @ApiProperty({ description: 'ID del proyecto' })
  @IsUUID('4')
  proyectoId: string;

  @ApiProperty({
    type: [ActividadJornadaOfflineDto],
    description: 'Actividades del plan incluidas en la jornada',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActividadJornadaOfflineDto)
  actividades: ActividadJornadaOfflineDto[];

  @ApiProperty({ description: 'ID de la vereda' })
  @IsUUID('4')
  veredaId: string;

  @ApiProperty({ description: 'ID del técnico responsable' })
  @IsUUID('4')
  tecnicoResponsableId: string;

  @ApiPropertyOptional({
    description: 'IDs de beneficiarios',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  beneficiarioIds?: string[];

  @ApiPropertyOptional({
    description: 'IDs del equipo',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  equipoIds?: string[];
}

export class EvidenciaOfflineDto {
  @ApiProperty({ description: 'ID local de la evidencia en el dispositivo' })
  @IsString()
  @IsNotEmpty()
  idLocal: string;

  @ApiProperty({ description: 'ID local de la jornada en el dispositivo' })
  @IsString()
  @IsNotEmpty()
  jornadaIdLocal: string;

  @ApiProperty({ enum: TipoEvidencia, description: 'Tipo de evidencia' })
  @IsEnum(TipoEvidencia)
  tipo: TipoEvidencia;

  @ApiProperty({ description: 'Nombre del archivo' })
  @IsString()
  @IsNotEmpty()
  nombreArchivo: string;

  @ApiProperty({ description: 'Tipo MIME del archivo' })
  @IsString()
  @IsNotEmpty()
  tipoMime: string;

  @ApiProperty({ description: 'Fecha de captura (ISO 8601)' })
  @IsISO8601()
  capturadoEn: string;

  @ApiPropertyOptional({ description: 'Latitud de ubicación' })
  @IsNumber()
  @IsOptional()
  latitud?: number;

  @ApiPropertyOptional({ description: 'Longitud de ubicación' })
  @IsNumber()
  @IsOptional()
  longitud?: number;

  @ApiPropertyOptional({ description: 'Tamaño del archivo en bytes' })
  @IsNumber()
  @IsOptional()
  tamanoArchivo?: number;
}

export class SubirSincronizacionDto {
  @ApiProperty({ description: 'Identificador único del dispositivo' })
  @IsString()
  @IsNotEmpty()
  dispositivoId: string;

  @ApiProperty({ description: 'Fecha de sincronización (ISO 8601)' })
  @IsISO8601()
  sincronizadoEn: string;

  @ApiProperty({
    type: [JornadaOfflineDto],
    description: 'Jornadas capturadas offline',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JornadaOfflineDto)
  jornadas: JornadaOfflineDto[];

  @ApiProperty({
    type: [EnvioFormularioOfflineDto],
    description: 'Envíos de formulario capturados offline',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvioFormularioOfflineDto)
  enviosFormulario: EnvioFormularioOfflineDto[];

  @ApiProperty({
    type: [EvidenciaOfflineDto],
    description: 'Evidencias capturadas offline',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenciaOfflineDto)
  evidencias: EvidenciaOfflineDto[];
}
