import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacionModule } from '../autenticacion/autenticacion.module';
import { Permiso } from './entities/permiso.entity';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { AdminsBootstrapService } from './admins-bootstrap.service';
import { PermisosSeedService } from './permisos-seed.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Rol, Permiso]),
    forwardRef(() => AutenticacionModule),
  ],
  controllers: [UsuariosController, RolesController],
  providers: [
    UsuariosService,
    RolesService,
    PermisosSeedService,
    AdminsBootstrapService,
  ],
  exports: [UsuariosService, TypeOrmModule, PermisosSeedService],
})
export class UsuariosModule {}
