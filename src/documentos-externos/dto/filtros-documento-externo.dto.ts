import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TipoDocumentoExterno } from '../enums/tipo-documento-externo.enum';

export class FiltrosDocumentoExternoDto {
  @ApiPropertyOptional({ description: 'Filtrar por proyecto' })
  @IsOptional()
  @IsUUID('4')
  proyectoId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por actividad' })
  @IsOptional()
  @IsUUID('4')
  actividadId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por subactividad' })
  @IsOptional()
  @IsUUID('4')
  subactividadId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por jornada' })
  @IsOptional()
  @IsUUID('4')
  jornadaId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por beneficiario' })
  @IsOptional()
  @IsUUID('4')
  beneficiarioId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por asociación' })
  @IsOptional()
  @IsUUID('4')
  asociacionId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por vereda (territorio)' })
  @IsOptional()
  @IsUUID('4')
  veredaId?: string;

  @ApiPropertyOptional({ enum: TipoDocumentoExterno })
  @IsOptional()
  @IsEnum(TipoDocumentoExterno)
  tipo?: TipoDocumentoExterno;
}
