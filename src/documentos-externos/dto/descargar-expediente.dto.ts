import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, ValidateIf } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Limitar al agente responsable de la jornada' })
  @IsOptional()
  @IsUUID()
  agenteId?: string;
}
