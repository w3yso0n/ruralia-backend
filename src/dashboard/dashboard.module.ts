import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActividadesModule } from '../actividades/actividades.module';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { ConfiguracionDashboardService } from './configuracion-dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PreferenciaDashboardUsuario } from './entities/preferencia-dashboard-usuario.entity';
import { WidgetDashboard } from './entities/widget-dashboard.entity';
import { WidgetsDashboardSeedService } from './widgets-dashboard-seed.service';

@Module({
  imports: [
    ActividadesModule,
    TypeOrmModule.forFeature([
      Proyecto,
      Jornada,
      Evidencia,
      EnvioFormulario,
      WidgetDashboard,
      PreferenciaDashboardUsuario,
    ]),
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    ConfiguracionDashboardService,
    WidgetsDashboardSeedService,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
