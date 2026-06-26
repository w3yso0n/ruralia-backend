import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asociacion } from './entities/asociacion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asociacion])],
  exports: [TypeOrmModule],
})
export class AsociacionesModule {}
