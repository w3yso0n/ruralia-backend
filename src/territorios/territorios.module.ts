import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Corregimiento } from './entities/corregimiento.entity';
import { Departamento } from './entities/departamento.entity';
import { Municipio } from './entities/municipio.entity';
import { Region } from './entities/region.entity';
import { Vereda } from './entities/vereda.entity';
import { TerritoriosController } from './territorios.controller';
import { TerritoriosService } from './territorios.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Region,
      Departamento,
      Municipio,
      Corregimiento,
      Vereda,
    ]),
  ],
  controllers: [TerritoriosController],
  providers: [TerritoriosService],
  exports: [TypeOrmModule, TerritoriosService],
})
export class TerritoriosModule {}
