import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evidencia } from './entities/evidencia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Evidencia])],
  exports: [TypeOrmModule],
})
export class EvidenciasModule {}
