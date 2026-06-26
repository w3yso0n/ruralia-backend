import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { CampoFormulario } from '../formularios/entities/campo-formulario.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { SincronizacionController } from './sincronizacion.controller';
import { SincronizacionService } from './sincronizacion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Jornada,
      EnvioFormulario,
      RespuestaFormulario,
      CampoFormulario,
      PlantillaFormulario,
      Evidencia,
      Beneficiario,
      Usuario,
    ]),
  ],
  controllers: [SincronizacionController],
  providers: [SincronizacionService],
})
export class SincronizacionModule {}
