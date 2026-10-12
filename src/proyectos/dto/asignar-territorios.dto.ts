import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class AsignarTerritoriosDto {
  @ApiPropertyOptional({
    description:
      'IDs de veredas a asignar. Puede ir vacío si el proyecto queda a nivel de municipio.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  veredaIds?: string[];

  @ApiPropertyOptional({
    description: 'IDs de municipios a asignar al proyecto',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  municipioIds?: string[];
}
