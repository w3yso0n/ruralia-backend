import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { RolSistema } from '../usuarios/catalogo-permisos';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermisosSeedService } from '../usuarios/permisos-seed.service';

const EXTENSIONES_FOTO: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const TIPOS_FOTO_PERFIL = Object.keys(EXTENSIONES_FOTO);

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

  async actualizarFotoPerfil(
    usuario: Usuario,
    archivo: Express.Multer.File,
  ): Promise<Usuario> {
    const directorio = path.join(this.rutaSubidas(), 'usuarios', usuario.id);
    await fs.mkdir(directorio, { recursive: true });

    const extension =
      EXTENSIONES_FOTO[archivo.mimetype] ?? path.extname(archivo.originalname);
    const nombreArchivo = `${randomUUID()}${extension}`;
    await fs.writeFile(path.join(directorio, nombreArchivo), archivo.buffer);

    const fotoAnterior = usuario.urlFoto;
    usuario.urlFoto = path
      .join('subidas', 'usuarios', usuario.id, nombreArchivo)
      .replace(/\\/g, '/');
    await this.usuarioRepository.update(usuario.id, {
      urlFoto: usuario.urlFoto,
    });
    await this.eliminarArchivoFotoLocal(fotoAnterior);

    return this.cargarUsuarioPorId(usuario.id);
  }

  async eliminarFotoPerfil(usuario: Usuario): Promise<Usuario> {
    const fotoAnterior = usuario.urlFoto;
    await this.usuarioRepository
      .createQueryBuilder()
      .update(Usuario)
      .set({ urlFoto: () => 'NULL' })
      .where('id = :id', { id: usuario.id })
      .execute();
    await this.eliminarArchivoFotoLocal(fotoAnterior);

    return this.cargarUsuarioPorId(usuario.id);
  }

  private rutaSubidas(): string {
    return process.env.RUTA_SUBIDAS || path.join(process.cwd(), 'subidas');
  }

  /** Solo borra fotos subidas a la plataforma; las URLs externas (Google) se ignoran. */
  private async eliminarArchivoFotoLocal(url?: string | null): Promise<void> {
    if (!url?.startsWith('subidas/usuarios/')) return;
    const relativo = url.replace(/^subidas\//, '');
    try {
      await fs.unlink(path.join(this.rutaSubidas(), relativo));
    } catch {
      // el archivo ya no existe; no bloquea la actualización
    }
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
