import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CrearRegionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(80)
  codigo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descripcion?: string;
}

export class CrearDepartamentoDto {
  @ApiProperty()
  @IsUUID()
  regionId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({
    description: 'Código único (si se omite se genera desde el nombre)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  codigo?: string;
}

export class ActualizarNodoTerritorialDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(80)
  codigo?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  estaActivo?: boolean;

  @ApiPropertyOptional({ description: 'Solo departamentos: cambiar de región' })
  @IsUUID()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descripcion?: string;
}

export class CrearMunicipioDto {
  @ApiProperty()
  @IsUUID()
  departamentoId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(80)
  codigo?: string;
}

export class CrearVeredaAdminDto {
  @ApiProperty()
  @IsUUID()
  municipioId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(80)
  codigo?: string;
}
