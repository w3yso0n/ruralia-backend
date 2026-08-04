import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  IsString,
} from 'class-validator';
import { AccionAuditoria } from '../../common/workflow/accion-auditoria.enum';

export class FiltrosAuditoriaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jornadaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ enum: AccionAuditoria })
  @IsOptional()
  @IsEnum(AccionAuditoria)
  action?: AccionAuditoria;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number = 50;
}

export class RespuestaAuditLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiPropertyOptional()
  field?: string | null;

  @ApiPropertyOptional()
  previousValue?: unknown;

  @ApiPropertyOptional()
  newValue?: unknown;

  @ApiPropertyOptional()
  reason?: string | null;

  @ApiProperty({ enum: AccionAuditoria })
  action: AccionAuditoria;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userRole: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  jornadaId?: string | null;

  @ApiPropertyOptional()
  documentId?: string | null;

  @ApiPropertyOptional()
  documentVersionId?: string | null;

  @ApiPropertyOptional()
  source?: string | null;
}

export class RespuestaPaginadaAuditoriaDto {
  @ApiProperty({ type: [RespuestaAuditLogDto] })
  datos: RespuestaAuditLogDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;
}
