import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TipoDocumentoExterno } from '../enums/tipo-documento-externo.enum';

export class SubirDocumentoExternoDto {
  @ApiProperty({ description: 'Título descriptivo del documento' })
  @IsString()
  @MaxLength(300)
  titulo: string;

  @ApiPropertyOptional({ description: 'Descripción o contexto del documento' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ enum: TipoDocumentoExterno })
  @IsEnum(TipoDocumentoExterno)
  tipo: TipoDocumentoExterno;

  @ApiProperty({ description: 'Proyecto al que se vincula el documento' })
  @IsUUID('4')
  proyectoId: string;

  @ApiPropertyOptional({ description: 'Actividad vinculada' })
  @IsOptional()
  @IsUUID('4')
  actividadId?: string;

  @ApiPropertyOptional({ description: 'Subactividad vinculada' })
  @IsOptional()
  @IsUUID('4')
  subactividadId?: string;

  @ApiPropertyOptional({ description: 'Jornada vinculada' })
  @IsOptional()
  @IsUUID('4')
  jornadaId?: string;

  @ApiPropertyOptional({ description: 'Beneficiario vinculado' })
  @IsOptional()
  @IsUUID('4')
  beneficiarioId?: string;

  @ApiPropertyOptional({ description: 'Asociación vinculada' })
  @IsOptional()
  @IsUUID('4')
  asociacionId?: string;

  @ApiPropertyOptional({ description: 'Vereda (territorio) vinculada' })
  @IsOptional()
  @IsUUID('4')
  veredaId?: string;
}
