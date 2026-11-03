import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { LineaProductiva } from './entities/linea-productiva.entity';
import { LineasProductivasController } from './lineas-productivas.controller';
import { LineasProductivasService } from './lineas-productivas.service';

@Module({
  imports: [TypeOrmModule.forFeature([LineaProductiva]), UsuariosModule],
  controllers: [LineasProductivasController],
  providers: [LineasProductivasService],
  exports: [LineasProductivasService],
})
export class LineasProductivasModule {}
