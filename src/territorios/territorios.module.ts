import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Corregimiento } from './entities/corregimiento.entity';
import { Departamento } from './entities/departamento.entity';
import { Municipio } from './entities/municipio.entity';
import { Vereda } from './entities/vereda.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Departamento,
      Municipio,
      Corregimiento,
      Vereda,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class TerritoriosModule {}
