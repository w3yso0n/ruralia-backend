import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vereda } from '../territorios/entities/vereda.entity';
import { AsociacionesController } from './asociaciones.controller';
import { AsociacionesService } from './asociaciones.service';
import { Asociacion } from './entities/asociacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asociacion, Vereda])],
  controllers: [AsociacionesController],
  providers: [AsociacionesService],
  exports: [TypeOrmModule, AsociacionesService],
})
export class AsociacionesModule {}
