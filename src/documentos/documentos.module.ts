import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { JornadasModule } from '../jornadas/jornadas.module';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { Documento } from './entities/documento.entity';
import { DocumentoVersion } from './entities/documento-version.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Documento,
      DocumentoVersion,
      Jornada,
      EnvioFormulario,
    ]),
    AuditoriaModule,
    forwardRef(() => JornadasModule),
  ],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService, TypeOrmModule],
})
export class DocumentosModule {}
