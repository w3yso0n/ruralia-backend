import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { JornadasModule } from '../jornadas/jornadas.module';
import { CampoFormulario } from './entities/campo-formulario.entity';
import { EnvioFormulario } from './entities/envio-formulario.entity';
import { PlantillaFormulario } from './entities/plantilla-formulario.entity';
import { RespuestaFormulario } from './entities/respuesta-formulario.entity';
import { EnviosFormularioService } from './envios-formulario.service';
import { FormulariosController } from './formularios.controller';
import { PlantillasFormularioService } from './plantillas-formulario.service';

@Module({
  imports: [
    JornadasModule,
    TypeOrmModule.forFeature([
      PlantillaFormulario,
      CampoFormulario,
      EnvioFormulario,
      RespuestaFormulario,
      Subactividad,
    ]),
  ],
  controllers: [FormulariosController],
  providers: [PlantillasFormularioService, EnviosFormularioService],
  exports: [
    TypeOrmModule,
    PlantillasFormularioService,
    EnviosFormularioService,
  ],
})
export class FormulariosModule {}
