import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meta } from '../actividades/entities/meta.entity';
import { MetaPeriodo } from '../actividades/entities/meta-periodo.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rejection } from '../aprobaciones/entities/rejection.entity';
import { AsignacionMeta } from './entities/asignacion-meta.entity';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AsignacionMeta,
      Meta,
      MetaPeriodo,
      Proyecto,
      Jornada,
      Usuario,
      Evidencia,
      EnvioFormulario,
      Rejection,
    ]),
  ],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService],
  exports: [EvaluacionesService],
})
export class EvaluacionesModule {}
