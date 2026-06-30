import { ApiProperty } from '@nestjs/swagger';

export class RespuestaSubirEvidenciaDto {
  @ApiProperty({ description: 'ID del archivo encolado para procesamiento' })
  archivoId: string;

  @ApiProperty({
    description: 'Estado del archivo en la cola de procesamiento',
    enum: ['en_cola'],
    example: 'en_cola',
  })
  estado: 'en_cola';
}
