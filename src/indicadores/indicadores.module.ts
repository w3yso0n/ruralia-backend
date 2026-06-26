import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Indicador } from './entities/indicador.entity';
import { RegistroIndicador } from './entities/registro-indicador.entity';
import { IndicadoresController } from './indicadores.controller';
import { IndicadoresService } from './indicadores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Indicador,
      RegistroIndicador,
      Proyecto,
      Jornada,
    ]),
  ],
  controllers: [IndicadoresController],
  providers: [IndicadoresService],
  exports: [IndicadoresService, TypeOrmModule],
})
export class IndicadoresModule {}
