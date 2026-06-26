import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DecodedIdToken } from 'firebase-admin/auth';
import { Repository } from 'typeorm';
import { NombreRol } from '../usuarios/enums/nombre-rol.enum';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Injectable()
export class AutenticacionService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  async obtenerOCrearUsuario(decoded: DecodedIdToken): Promise<Usuario> {
    const existente = await this.usuarioRepository.findOne({
      where: { firebaseUid: decoded.uid },
      relations: { roles: true },
    });

    if (existente) {
      return existente;
    }

    const rolVisualizador = await this.obtenerRol(NombreRol.VISUALIZADOR);

    const nuevoUsuario = this.usuarioRepository.create({
      firebaseUid: decoded.uid,
      correo: decoded.email ?? `${decoded.uid}@firebase.local`,
      nombreCompleto: decoded.name ?? decoded.email ?? 'Usuario',
      urlFoto: decoded.picture ?? undefined,
      estaActivo: true,
      roles: [rolVisualizador],
    });

    await this.usuarioRepository.save(nuevoUsuario);

    return this.usuarioRepository.findOneOrFail({
      where: { id: nuevoUsuario.id },
      relations: { roles: true },
    });
  }

  private async obtenerRol(nombre: NombreRol): Promise<Rol> {
    let rol = await this.rolRepository.findOne({ where: { nombre } });

    if (!rol) {
      rol = this.rolRepository.create({ nombre });
      await this.rolRepository.save(rol);
    }

    return rol;
  }
}
