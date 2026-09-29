import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { Vereda } from '../territorios/entities/vereda.entity';
import { AsociacionesController } from './asociaciones.controller';
import { AsociacionesService } from './asociaciones.service';
import { Asociacion } from './entities/asociacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asociacion, Beneficiario, Vereda])],
  controllers: [AsociacionesController],
  providers: [AsociacionesService],
  exports: [TypeOrmModule, AsociacionesService],
})
export class AsociacionesModule {}
