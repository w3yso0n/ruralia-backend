import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proceso } from '../actividades/entities/proceso.entity';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { CronologiaModule } from '../cronologia/cronologia.module';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { JornadasModule } from '../jornadas/jornadas.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CampoFormulario } from './entities/campo-formulario.entity';
import { EnvioFormulario } from './entities/envio-formulario.entity';
import { PlantillaFormulario } from './entities/plantilla-formulario.entity';
import { RespuestaFormulario } from './entities/respuesta-formulario.entity';
import { EnviosFormularioService } from './envios-formulario.service';
import { FormulariosController } from './formularios.controller';
import { PlantillasFormularioService } from './plantillas-formulario.service';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { CampoBeneficiario } from '../beneficiarios/entities/campo-beneficiario.entity';
import { AutocompletadoFormularioService } from './autocompletado-formulario.service';

@Module({
  imports: [
    UsuariosModule,
    JornadasModule,
    CronologiaModule,
    AuditoriaModule,
    TypeOrmModule.forFeature([
      PlantillaFormulario,
      CampoFormulario,
      EnvioFormulario,
      RespuestaFormulario,
      Proceso,
      Subactividad,
      Usuario,
      Jornada,
      Beneficiario,
      CampoBeneficiario,
    ]),
  ],
  controllers: [FormulariosController],
  providers: [
    PlantillasFormularioService,
    EnviosFormularioService,
    AutocompletadoFormularioService,
  ],
  exports: [
    TypeOrmModule,
    PlantillasFormularioService,
    EnviosFormularioService,
  ],
})
export class FormulariosModule {}
