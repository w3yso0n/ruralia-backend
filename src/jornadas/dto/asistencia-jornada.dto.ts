import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AsistenteJornadaDto {
  @ApiPropertyOptional({
    description: 'ID del asistente (para actualizar uno existente)',
  })
  @IsUUID('4')
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Nombre completo del asistente' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombreCompleto: string;

  @ApiPropertyOptional({ description: 'Documento de identidad (opcional)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  documento?: string;

  @ApiPropertyOptional({
    description: 'Firma virtual como data URL PNG (image/png;base64,...)',
  })
  @IsString()
  @IsOptional()
  firmaDataUrl?: string | null;
}

export class GuardarAsistenciaJornadaDto {
  @ApiProperty({
    type: [AsistenteJornadaDto],
    description: 'Lista completa de asistentes (reemplaza la anterior)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsistenteJornadaDto)
  asistentes: AsistenteJornadaDto[];
}

export class CrearAsistenteJornadaDto {
  @ApiProperty({ description: 'Nombre completo del asistente' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombreCompleto: string;

  @ApiPropertyOptional({ description: 'Documento de identidad (opcional)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  documento?: string;
}

export class ActualizarAsistenteJornadaDto {
  @ApiPropertyOptional({ description: 'Nombre completo del asistente' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  nombreCompleto?: string;

  @ApiPropertyOptional({ description: 'Documento de identidad' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  documento?: string | null;

  @ApiPropertyOptional({
    description: 'Firma virtual como data URL PNG; null limpia la firma',
  })
  @IsString()
  @IsOptional()
  firmaDataUrl?: string | null;
}

export class RespuestaAsistenteJornadaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombreCompleto: string;

  @ApiPropertyOptional()
  documento?: string | null;

  @ApiPropertyOptional()
  firmaDataUrl?: string | null;

  @ApiPropertyOptional()
  firmadoEn?: Date | null;

  @ApiProperty()
  orden: number;
}
