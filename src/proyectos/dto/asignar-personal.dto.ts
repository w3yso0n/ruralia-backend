import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AsignarPersonalDto {
  @ApiProperty({
    description: 'IDs de usuarios a asignar al proyecto',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  usuarioIds: string[];
}
