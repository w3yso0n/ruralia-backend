import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { ArchivosController } from './archivos.controller';
import { ArchivosService } from './archivos.service';
import { RecuperacionEvidenciasController } from './recuperacion-evidencias.controller';
import { RecuperacionEvidenciasService } from './recuperacion-evidencias.service';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [UsuariosModule, TypeOrmModule.forFeature([Evidencia, Jornada])],
  controllers: [ArchivosController, RecuperacionEvidenciasController],
  providers: [ArchivosService, RecuperacionEvidenciasService],
  exports: [ArchivosService],
})
export class ArchivosModule {}
