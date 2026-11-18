import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Corregimiento } from './entities/corregimiento.entity';
import { Departamento } from './entities/departamento.entity';
import { Municipio } from './entities/municipio.entity';
import { Region } from './entities/region.entity';
import { Vereda } from './entities/vereda.entity';
import { VeredaPdet } from './entities/vereda-pdet.entity';
import { TerritoriosController } from './territorios.controller';
import { TerritoriosService } from './territorios.service';
import { VeredasPdetController } from './veredas-pdet.controller';
import { VeredasPdetService } from './veredas-pdet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Region,
      Departamento,
      Municipio,
      Corregimiento,
      Vereda,
      VeredaPdet,
    ]),
  ],
  controllers: [VeredasPdetController, TerritoriosController],
  providers: [TerritoriosService, VeredasPdetService],
  exports: [TypeOrmModule, TerritoriosService, VeredasPdetService],
})
export class TerritoriosModule {}
