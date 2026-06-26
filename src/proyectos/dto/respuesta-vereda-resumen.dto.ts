import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RespuestaVeredaResumenDto {
  @ApiProperty({ description: 'ID de la vereda' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Nombre de la vereda' })
  @Expose()
  nombre: string;

  @ApiProperty({ description: 'Código de la vereda' })
  @Expose()
  codigo: string;
}
