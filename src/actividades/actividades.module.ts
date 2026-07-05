import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { ActividadesController } from './actividades.controller';
import { ActividadesService } from './actividades.service';
import { Actividad } from './entities/actividad.entity';
import { Subactividad } from './entities/subactividad.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Actividad, Subactividad, Proyecto])],
  controllers: [ActividadesController],
  providers: [ActividadesService],
  exports: [TypeOrmModule, ActividadesService],
})
export class ActividadesModule {}
