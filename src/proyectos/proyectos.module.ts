import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Indicador } from '../indicadores/entities/indicador.entity';
import { RegistroIndicador } from '../indicadores/entities/registro-indicador.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Vereda } from '../territorios/entities/vereda.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Proyecto,
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
