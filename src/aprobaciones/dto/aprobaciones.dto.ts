import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { EntidadRevisable } from '../../common/workflow/entidad-revisable.enum';
import { EstadoFuncional } from '../../common/workflow/estado-funcional.enum';
import { CategoriaRechazo } from '../enums/categoria-rechazo.enum';

export class EnviarRevisionDto {
  @ApiPropertyOptional({ description: 'Motivo u observación al enviar' })
  @IsOptional()
  @IsString()
  notas?: string;
}

export class AprobarDto {
  @ApiProperty({ enum: EntidadRevisable })
  @IsEnum(EntidadRevisable)
  entityType: EntidadRevisable;

  @ApiProperty()
  @IsUUID()
  entityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  documentVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RechazarDto {
  @ApiProperty({ enum: EntidadRevisable })
  @IsEnum(EntidadRevisable)
  entityType: EntidadRevisable;

  @ApiProperty()
  @IsUUID()
  entityId: string;

  @ApiProperty({ enum: CategoriaRechazo })
  @IsEnum(CategoriaRechazo)
  category: CategoriaRechazo;

  @ApiProperty({ description: 'Motivo del rechazo' })
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiProperty({ description: 'Corrección solicitada (obligatoria)' })
  @IsString()
  @MinLength(3)
  requestedCorrection: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  evidenceId?: string;
}

export class ReenviarRevisionDto {
  @ApiProperty({ description: 'Motivo de la corrección realizada' })
  @IsString()
  @MinLength(3)
  changeReason: string;
}

export class FiltrosBandejaDto {
  @ApiPropertyOptional({ enum: EstadoFuncional })
  @IsOptional()
  @IsEnum(EstadoFuncional)
  estadoFuncional?: EstadoFuncional;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  proyectoId?: string;

  @ApiPropertyOptional({
    description: 'tecnico | supervisor | coordinacion',
  })
  @IsOptional()
  @IsString()
  vista?: 'tecnico' | 'supervisor' | 'coordinacion';
}
