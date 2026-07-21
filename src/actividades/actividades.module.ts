import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronologiaModule } from '../cronologia/cronologia.module';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { ActividadesController } from './actividades.controller';
import { ActividadesService } from './actividades.service';
import { Meta } from './entities/meta.entity';
import { MetaPeriodo } from './entities/meta-periodo.entity';
import { Proceso } from './entities/proceso.entity';
import { Actividad } from './entities/actividad.entity';
import { Subactividad } from './entities/subactividad.entity';
import { ProcesosController } from './procesos.controller';
import { ProcesosService } from './procesos.service';

@Module({
  imports: [
    CronologiaModule,
    TypeOrmModule.forFeature([
      Actividad,
      Subactividad,
      Proceso,
      Meta,
      MetaPeriodo,
      Proyecto,
      Jornada,
    ]),
  ],
  controllers: [ActividadesController, ProcesosController],
  providers: [ActividadesService, ProcesosService],
  exports: [TypeOrmModule, ActividadesService, ProcesosService],
})
export class ActividadesModule {}
