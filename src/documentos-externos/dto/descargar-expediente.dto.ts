import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class DescargarExpedienteDto {
  @ApiPropertyOptional({ description: 'Fecha inicial inclusive (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ description: 'Fecha final inclusive (YYYY-MM-DD)' })
  @ValidateIf((dto: DescargarExpedienteDto) => Boolean(dto.desde))
  @IsDateString()
  hasta?: string;

  @ApiPropertyOptional({ description: 'Limitar a un proceso del plan' })
  @IsOptional()
  @IsUUID()
  procesoId?: string;

  @ApiPropertyOptional({
    description: 'Limitar al agente responsable de la jornada',
  })
  @IsOptional()
  @IsUUID()
  agenteId?: string;

  @ApiPropertyOptional({
    description:
      'Agregar los documentos externos del proyecto en una carpeta aparte, fuera de las jornadas',
  })
  @IsOptional()
  @IsBoolean()
  incluirExternos?: boolean;

  @ApiPropertyOptional({
    description:
      'Descargar exactamente estas jornadas del proyecto (las que quedaron en la pantalla de jornadas tras filtrar). Si se envía, se ignoran los demás filtros y los documentos externos.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  jornadaIds?: string[];
}
