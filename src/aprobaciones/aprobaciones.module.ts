import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { CronologiaModule } from '../cronologia/cronologia.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { Documento } from '../documentos/entities/documento.entity';
import { DocumentoVersion } from '../documentos/entities/documento-version.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { AprobacionesController } from './aprobaciones.controller';
import { AprobacionesService } from './aprobaciones.service';
import { Approval } from './entities/approval.entity';
import { Rejection } from './entities/rejection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Approval,
      Rejection,
      Jornada,
      Evidencia,
      Documento,
      DocumentoVersion,
    ]),
    AuditoriaModule,
    CronologiaModule,
    forwardRef(() => DocumentosModule),
  ],
  controllers: [AprobacionesController],
  providers: [AprobacionesService],
  exports: [AprobacionesService],
})
export class AprobacionesModule {}
