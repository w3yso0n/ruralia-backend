import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DecodedIdToken } from 'firebase-admin/auth';
import { Repository } from 'typeorm';
import { RolSistema } from '../usuarios/catalogo-permisos';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermisosSeedService } from '../usuarios/permisos-seed.service';

@Injectable()
export class AutenticacionService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    private readonly permisosSeed: PermisosSeedService,
  ) {}

  async obtenerOCrearUsuario(decoded: DecodedIdToken): Promise<Usuario> {
    const existente = await this.cargarUsuarioPorFirebaseUid(decoded.uid);

    if (existente) {
      return existente;
    }

    await this.permisosSeed.asegurarCatalogoYRoles();
    const rolVisualizador = await this.obtenerRolSistema(
      RolSistema.VISUALIZADOR,
    );

    const nuevoUsuario = this.usuarioRepository.create({
      firebaseUid: decoded.uid,
      correo: decoded.email ?? `${decoded.uid}@firebase.local`,
      nombreCompleto: decoded.name ?? decoded.email ?? 'Usuario',
      urlFoto: decoded.picture ?? undefined,
      estaActivo: true,
      roles: [rolVisualizador],
    });

    await this.usuarioRepository.save(nuevoUsuario);

    return this.cargarUsuarioPorId(nuevoUsuario.id);
  }

  async cargarUsuarioPorId(id: string): Promise<Usuario> {
    return this.usuarioRepository.findOneOrFail({
      where: { id },
      relations: { roles: { permisos: true } },
    });
  }

  private async cargarUsuarioPorFirebaseUid(
    firebaseUid: string,
  ): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { firebaseUid },
      relations: { roles: { permisos: true } },
    });
  }

  private async obtenerRolSistema(nombre: RolSistema): Promise<Rol> {
    const rol = await this.rolRepository.findOne({
      where: { nombre },
      relations: { permisos: true },
    });
    if (!rol) {
      throw new Error(`Rol de sistema ${nombre} no encontrado`);
    }
    return rol;
  }
}
