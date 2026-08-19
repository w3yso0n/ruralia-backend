import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { DocumentosExternosController } from './documentos-externos.controller';
import { DocumentosExternosService } from './documentos-externos.service';
import { DocumentoExterno } from './entities/documento-externo.entity';
import { ExpedienteController } from './expediente.controller';
import { ExpedienteService } from './expediente.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentoExterno]),
    AuditoriaModule,
    DocumentosModule,
  ],
  controllers: [DocumentosExternosController, ExpedienteController],
  providers: [DocumentosExternosService, ExpedienteService],
  exports: [DocumentosExternosService],
})
export class DocumentosExternosModule {}
