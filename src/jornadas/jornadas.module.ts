import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actividad } from '../actividades/entities/actividad.entity';
import { Meta } from '../actividades/entities/meta.entity';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CronologiaModule } from '../cronologia/cronologia.module';
import { JornadaActividad } from './entities/jornada-actividad.entity';
import { JornadaAsistente } from './entities/jornada-asistente.entity';
import { Jornada } from './entities/jornada.entity';
import { JornadasController } from './jornadas.controller';
import { JornadasService } from './jornadas.service';

@Module({
  imports: [
    CronologiaModule,
    TypeOrmModule.forFeature([
      Jornada,
      JornadaActividad,
      JornadaAsistente,
      Meta,
      Proyecto,
      Actividad,
      Subactividad,
      Beneficiario,
      Usuario,
      EnvioFormulario,
      PlantillaFormulario,
      RespuestaFormulario,
      Evidencia,
    ]),
  ],
  controllers: [JornadasController],
  providers: [JornadasService],
  exports: [JornadasService, TypeOrmModule],
})
export class JornadasModule {}
