import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { ArchivosController } from './archivos.controller';
import { ArchivosService } from './archivos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Evidencia, Jornada])],
  controllers: [ArchivosController],
  providers: [ArchivosService],
  exports: [ArchivosService],
})
export class ArchivosModule {}
