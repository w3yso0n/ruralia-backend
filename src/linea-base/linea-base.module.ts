import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { HistorialDatoBeneficiario } from '../beneficiarios/entities/historial-dato-beneficiario.entity';
import { CronologiaModule } from '../cronologia/cronologia.module';
import { DocumentoVersion } from '../documentos/entities/documento-version.entity';
import { Documento } from '../documentos/entities/documento.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { LineasProductivasModule } from '../lineas-productivas/lineas-productivas.module';
import { ProyectoBeneficiario } from '../proyectos/entities/proyecto-beneficiario.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AplicacionLineaBaseService } from './aplicacion-linea-base.service';
import { ExcelLineaBaseService } from './excel-linea-base.service';
import { LineaBaseController } from './linea-base.controller';
import { LineaBaseService } from './linea-base.service';

/**
 * Línea base del proyecto. No depende de Aprobaciones ni de Jornadas para
 * evitar ciclos: Aprobaciones importa este módulo para aplicar las
 * respuestas al beneficiario al aprobar.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Proyecto,
      PlantillaFormulario,
      Beneficiario,
      ProyectoBeneficiario,
      Jornada,
      Usuario,
      EnvioFormulario,
      RespuestaFormulario,
      Documento,
      DocumentoVersion,
      HistorialDatoBeneficiario,
    ]),
    UsuariosModule,
    CronologiaModule,
    LineasProductivasModule,
  ],
  controllers: [LineaBaseController],
  providers: [
    LineaBaseService,
    AplicacionLineaBaseService,
    ExcelLineaBaseService,
  ],
  exports: [LineaBaseService, AplicacionLineaBaseService],
})
export class LineaBaseModule {}
