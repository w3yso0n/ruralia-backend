import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { Documento } from '../documentos/entities/documento.entity';
import { EvidenciasModule } from '../evidencias/evidencias.module';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { DocumentosExternosController } from './documentos-externos.controller';
import { DocumentosExternosService } from './documentos-externos.service';
import { DocumentoExterno } from './entities/documento-externo.entity';
import { ExpedienteController } from './expediente.controller';
import { ExpedienteDescargaService } from './expediente-descarga.service';
import { ExpedienteService } from './expediente.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentoExterno,
      EnvioFormulario,
      Proyecto,
      Jornada,
      Documento,
    ]),
    AuditoriaModule,
    DocumentosModule,
    EvidenciasModule,
  ],
  controllers: [DocumentosExternosController, ExpedienteController],
  providers: [DocumentosExternosService, ExpedienteService, ExpedienteDescargaService],
  exports: [DocumentosExternosService],
})
export class DocumentosExternosModule {}
