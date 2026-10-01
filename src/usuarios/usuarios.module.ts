import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutenticacionModule } from '../autenticacion/autenticacion.module';
import { Permiso } from './entities/permiso.entity';
import { Rol } from './entities/rol.entity';
import { UsuarioAlcanceTerritorial } from './entities/usuario-alcance-territorial.entity';
import { Usuario } from './entities/usuario.entity';
import { AlcanceTerritorialService } from './alcance-territorial.service';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Departamento } from '../territorios/entities/departamento.entity';
import { Municipio } from '../territorios/entities/municipio.entity';
import { Region } from '../territorios/entities/region.entity';
import { Vereda } from '../territorios/entities/vereda.entity';
import { AdminsBootstrapService } from './admins-bootstrap.service';
import { PermisosSeedService } from './permisos-seed.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Rol,
      Permiso,
      UsuarioAlcanceTerritorial,
      Proyecto,
      Region,
      Departamento,
      Municipio,
      Vereda,
    ]),
    forwardRef(() => AutenticacionModule),
  ],
  controllers: [UsuariosController, RolesController],
  providers: [
    UsuariosService,
    AlcanceTerritorialService,
    RolesService,
    PermisosSeedService,
    AdminsBootstrapService,
  ],
  exports: [
    UsuariosService,
    AlcanceTerritorialService,
    TypeOrmModule,
    PermisosSeedService,
  ],
})
export class UsuariosModule {}
