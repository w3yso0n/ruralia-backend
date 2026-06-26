import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actividad } from '../actividades/entities/actividad.entity';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Proyecto,
      Jornada,
      Beneficiario,
      EnvioFormulario,
      Evidencia,
      Actividad,
      Subactividad,
      PlantillaFormulario,
    ]),
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
