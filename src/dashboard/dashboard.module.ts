import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActividadesModule } from '../actividades/actividades.module';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { ConfiguracionDashboardService } from './configuracion-dashboard.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AsignacionPlantillaRol } from './entities/asignacion-plantilla-rol.entity';
import { ItemPlantillaDashboard } from './entities/item-plantilla-dashboard.entity';
import { PlantillaDashboard } from './entities/plantilla-dashboard.entity';
import { PreferenciaDashboardUsuario } from './entities/preferencia-dashboard-usuario.entity';
import { WidgetDashboard } from './entities/widget-dashboard.entity';
import { PlantillasDashboardController } from './plantillas-dashboard.controller';
import { PlantillasDashboardService } from './plantillas-dashboard.service';
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
      PlantillaDashboard,
      ItemPlantillaDashboard,
      AsignacionPlantillaRol,
      Rol,
    ]),
  ],
  controllers: [DashboardController, PlantillasDashboardController],
  providers: [
    DashboardService,
    ConfiguracionDashboardService,
    WidgetsDashboardSeedService,
    PlantillasDashboardService,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
