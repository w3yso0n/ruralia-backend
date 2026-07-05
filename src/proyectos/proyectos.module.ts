import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActividadesModule } from '../actividades/actividades.module';
import { Asociacion } from '../asociaciones/entities/asociacion.entity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Indicador } from '../indicadores/entities/indicador.entity';
import { RegistroIndicador } from '../indicadores/entities/registro-indicador.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Vereda } from '../territorios/entities/vereda.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ProyectoAsociacion } from './entities/proyecto-asociacion.entity';
import { ProyectoBeneficiario } from './entities/proyecto-beneficiario.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';

@Module({
  imports: [
    ActividadesModule,
    TypeOrmModule.forFeature([
      Proyecto,
      ProyectoBeneficiario,
      ProyectoAsociacion,
      Beneficiario,
      Asociacion,
      Vereda,
      Usuario,
      Jornada,
      EnvioFormulario,
      Indicador,
      RegistroIndicador,
    ]),
  ],
  controllers: [ProyectosController],
  providers: [ProyectosService],
  exports: [TypeOrmModule, ProyectosService],
})
export class ProyectosModule {}
