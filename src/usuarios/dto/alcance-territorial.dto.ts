import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { TipoAlcanceTerritorial } from '../enums/tipo-alcance-territorial.enum';

export class ItemAlcanceTerritorialDto {
  @ApiProperty({ enum: TipoAlcanceTerritorial })
  @IsEnum(TipoAlcanceTerritorial)
  tipo: TipoAlcanceTerritorial;

  @ApiProperty()
  @IsUUID('4')
  referenciaId: string;
}

export class ReemplazarAlcanceTerritorialDto {
  @ApiProperty({ type: [ItemAlcanceTerritorialDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemAlcanceTerritorialDto)
  items: ItemAlcanceTerritorialDto[];
}
