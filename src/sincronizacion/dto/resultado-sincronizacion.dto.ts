import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ErrorSincronizacionDto {
  @ApiProperty({
    enum: ['jornada', 'envio', 'evidencia'],
    description: 'Tipo de entidad con error',
  })
  @Expose()
  tipo: 'jornada' | 'envio' | 'evidencia';

  @ApiProperty({ description: 'ID local del registro con error' })
  @Expose()
  idLocal: string;

  @ApiProperty({ description: 'Mensaje de error' })
  @Expose()
  mensaje: string;
}

export class ResultadoSincronizacionDto {
  @ApiProperty({ description: 'Cantidad de registros aceptados' })
  @Expose()
  aceptados: number;

  @ApiProperty({ description: 'Cantidad de registros omitidos' })
  @Expose()
  omitidos: number;

  @ApiProperty({
    type: [ErrorSincronizacionDto],
    description: 'Errores de sincronización',
  })
  @Expose()
  errores: ErrorSincronizacionDto[];
}
