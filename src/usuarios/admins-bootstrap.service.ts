import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseAdminService } from '../autenticacion/firebase-admin.service';
import { RolSistema } from './catalogo-permisos';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { PermisosSeedService } from './permisos-seed.service';

const ADMINS_POR_DEFECTO = [
  {
    correo: 'lpipeavila1@gmail.com',
    contrasena: '12345678',
    nombreCompleto: 'Luis Pipe Avila',
  },
  {
    correo: 'admin@cuantiva.io',
    contrasena: '12345678',
    nombreCompleto: 'Admin Cuantiva',
  },
] as const;

@Injectable()
export class AdminsBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminsBootstrapService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly permisosSeed: PermisosSeedService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.permisosSeed.asegurarCatalogoYRoles();
    const rolAdmin = await this.rolRepository.findOne({
      where: { nombre: RolSistema.ADMINISTRADOR },
    });
    if (!rolAdmin) {
      this.logger.error(
        'No se encontraron admins por defecto: falta el rol ADMINISTRADOR',
      );
      return;
    }

    for (const admin of ADMINS_POR_DEFECTO) {
      try {
        await this.asegurarAdmin(admin, rolAdmin);
        this.logger.log(`Admin listo: ${admin.correo}`);
      } catch (error) {
        this.logger.error(
          `No se pudo asegurar el admin ${admin.correo}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }
  }

  private async asegurarAdmin(
    def: (typeof ADMINS_POR_DEFECTO)[number],
    rolAdmin: Rol,
  ): Promise<void> {
    const firebaseUser = await this.firebaseAdmin.asegurarUsuario(
      def.correo,
      def.contrasena,
      def.nombreCompleto,
    );

    let usuario = await this.usuarioRepository.findOne({
      where: { correo: def.correo },
      relations: { roles: true },
    });
    if (!usuario) {
      usuario = await this.usuarioRepository.findOne({
        where: { firebaseUid: firebaseUser.uid },
        relations: { roles: true },
      });
    }

    if (!usuario) {
      await this.usuarioRepository.save(
        this.usuarioRepository.create({
          firebaseUid: firebaseUser.uid,
          correo: def.correo,
          nombreCompleto: def.nombreCompleto,
          estaActivo: true,
          roles: [rolAdmin],
        }),
      );
      return;
    }

    usuario.firebaseUid = firebaseUser.uid;
    usuario.correo = def.correo;
    usuario.nombreCompleto = def.nombreCompleto;
    usuario.estaActivo = true;
    const roles = usuario.roles ?? [];
    if (!roles.some((rol) => rol.nombre === RolSistema.ADMINISTRADOR)) {
      roles.push(rolAdmin);
    }
    usuario.roles = roles;
    await this.usuarioRepository.save(usuario);
  }
}
