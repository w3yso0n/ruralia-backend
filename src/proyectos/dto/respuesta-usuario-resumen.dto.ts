import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RespuestaUsuarioResumenDto {
  @ApiProperty({ description: 'ID del usuario' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Nombre completo del usuario' })
  @Expose()
  nombreCompleto: string;

  @ApiProperty({ description: 'Correo electrónico del usuario' })
  @Expose()
  correo: string;
}
