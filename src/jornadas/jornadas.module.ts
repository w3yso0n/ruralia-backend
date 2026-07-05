import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actividad } from '../actividades/entities/actividad.entity';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { JornadaActividad } from './entities/jornada-actividad.entity';
import { Jornada } from './entities/jornada.entity';
import { JornadasController } from './jornadas.controller';
import { JornadasService } from './jornadas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Jornada,
      JornadaActividad,
      Proyecto,
      Actividad,
      Subactividad,
      Beneficiario,
      Usuario,
      EnvioFormulario,
      Evidencia,
    ]),
  ],
  controllers: [JornadasController],
  providers: [JornadasService],
  exports: [JornadasService, TypeOrmModule],
})
export class JornadasModule {}
