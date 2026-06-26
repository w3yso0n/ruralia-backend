import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SubirEvidenciaDto {
  @ApiProperty({ description: 'ID de la evidencia' })
  @IsUUID('4')
  evidenciaId: string;

  @ApiProperty({ description: 'ID de la jornada' })
  @IsUUID('4')
  jornadaId: string;
}
