import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespuestaNodoTerritorialDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  estaActivo: boolean;

  @ApiPropertyOptional()
  padreId?: string;

  @ApiPropertyOptional({
    description: 'Cantidad de hijos directos (si aplica)',
  })
  conteoHijos?: number;
}
