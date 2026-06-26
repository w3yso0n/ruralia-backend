import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AsignarTerritoriosDto {
  @ApiProperty({
    description: 'IDs de veredas a asignar al proyecto',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  veredaIds: string[];
}
