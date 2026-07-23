import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespuestaBusquedaTerritorialDto {
  @ApiProperty({ enum: ['region', 'departamento', 'municipio', 'vereda'] })
  nivel: 'region' | 'departamento' | 'municipio' | 'vereda';

  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  estaActivo: boolean;

  @ApiProperty({
    description: 'Ruta legible, p. ej. "Andina › Cundinamarca › Bogotá"',
  })
  ruta: string;

  @ApiPropertyOptional()
  regionId?: string;

  @ApiPropertyOptional()
  departamentoId?: string;

  @ApiPropertyOptional()
  municipioId?: string;

  @ApiPropertyOptional()
  veredaId?: string;
}
