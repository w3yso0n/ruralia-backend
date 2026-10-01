import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CronologiaController } from './cronologia.controller';
import { CronologiaService } from './cronologia.service';
import { EventoCronologia } from './entities/evento-cronologia.entity';

@Module({
  imports: [UsuariosModule, TypeOrmModule.forFeature([EventoCronologia, Proyecto])],
  controllers: [CronologiaController],
  providers: [CronologiaService],
  exports: [CronologiaService, TypeOrmModule],
})
export class CronologiaModule {}
