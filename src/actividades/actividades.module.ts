import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actividad } from './entities/actividad.entity';
import { Subactividad } from './entities/subactividad.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Actividad, Subactividad])],
  exports: [TypeOrmModule],
})
export class ActividadesModule {}
