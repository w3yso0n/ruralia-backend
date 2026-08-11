import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActividadesModule } from '../actividades/actividades.module';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    ActividadesModule,
    TypeOrmModule.forFeature([
      Proyecto,
      Jornada,
      Evidencia,
      EnvioFormulario,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
