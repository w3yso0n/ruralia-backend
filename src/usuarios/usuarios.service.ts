import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FirebaseAdminService } from '../autenticacion/firebase-admin.service';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { FiltrosUsuarioDto } from './dto/filtros-usuario.dto';
import {
  RespuestaPaginadaUsuariosDto,
  RespuestaUsuarioDto,
} from './dto/respuesta-usuario.dto';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { PermisosSeedService } from './permisos-seed.service';
import {
  aRespuestaPaginadaUsuarios,
  aRespuestaUsuario,
} from './utils/serializar-usuario';
import { usuarioTienePermisos } from './utils/permisos-usuario';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly permisosSeed: PermisosSeedService,
  ) {}

  async listar(
    filtros: FiltrosUsuarioDto,
  ): Promise<RespuestaPaginadaUsuariosDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 10;
    const skip = (pagina - 1) * limite;

    const query = this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.roles', 'roles')
      .leftJoinAndSelect('roles.permisos', 'permisos')
      .orderBy('usuario.creadoEn', 'DESC');

    if (filtros.busqueda) {
      query.andWhere(
        '(usuario.nombreCompleto ILIKE :busqueda OR usuario.correo ILIKE :busqueda)',
        { busqueda: `%${filtros.busqueda}%` },
      );
    }

    if (filtros.estaActivo !== undefined) {
      query.andWhere('usuario.estaActivo = :estaActivo', {
        estaActivo: filtros.estaActivo,
      });
    }

    const [usuarios, total] = await query.skip(skip).take(limite).getManyAndCount();
    const datos = usuarios.map((usuario) => aRespuestaUsuario(usuario));
    return aRespuestaPaginadaUsuarios(datos, total, pagina, limite);
  }

  async obtenerUno(id: string): Promise<RespuestaUsuarioDto> {
    const usuario = await this.buscarUsuario(id);
    return aRespuestaUsuario(usuario);
  }

  async crear(dto: CrearUsuarioDto): Promise<RespuestaUsuarioDto> {
    const existente = await this.usuarioRepository.findOne({
      where: { correo: dto.correo },
    });

    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const firebaseUser = await this.firebaseAdmin.crearUsuario(
      dto.correo,
      dto.contrasena,
      dto.nombreCompleto,
    );

    try {
      const roles = await this.obtenerRolesPorIds(dto.rolIds);
      const usuario = this.usuarioRepository.create({
        firebaseUid: firebaseUser.uid,
        correo: dto.correo,
        nombreCompleto: dto.nombreCompleto,
        urlFoto: dto.urlFoto,
        estaActivo: true,
        roles,
      });

      const guardado = await this.usuarioRepository.save(usuario);
      return this.obtenerUno(guardado.id);
    } catch (error) {
      await this.firebaseAdmin.eliminarUsuario(firebaseUser.uid);
      throw error;
    }
  }

  async actualizar(
    id: string,
    dto: ActualizarUsuarioDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaUsuarioDto> {
    const usuario = await this.buscarUsuario(id);
    this.verificarNoAutoDesactivacion(id, dto, usuarioActual);

    if (dto.correo && dto.correo !== usuario.correo) {
      const duplicado = await this.usuarioRepository.findOne({
        where: { correo: dto.correo },
      });
      if (duplicado && duplicado.id !== id) {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
    }

    const rolesNuevos =
      dto.rolIds !== undefined
        ? await this.obtenerRolesPorIds(dto.rolIds)
        : undefined;

    await this.validarNoOrfandadAdmin(
      usuario,
      dto.estaActivo,
      rolesNuevos,
    );

    await this.firebaseAdmin.actualizarUsuario(usuario.firebaseUid, {
      correo: dto.correo,
      contrasena: dto.contrasena,
      nombreCompleto: dto.nombreCompleto,
      deshabilitado:
        dto.estaActivo !== undefined ? !dto.estaActivo : undefined,
    });

    if (dto.nombreCompleto !== undefined) {
      usuario.nombreCompleto = dto.nombreCompleto;
    }
    if (dto.correo !== undefined) usuario.correo = dto.correo;
    if (dto.urlFoto !== undefined) usuario.urlFoto = dto.urlFoto;
    if (dto.estaActivo !== undefined) usuario.estaActivo = dto.estaActivo;
    if (rolesNuevos !== undefined) usuario.roles = rolesNuevos;

    await this.usuarioRepository.save(usuario);
    return this.obtenerUno(id);
  }

  async eliminar(id: string, usuarioActual: Usuario): Promise<void> {
    if (usuarioActual.id === id) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta');
    }

    const usuario = await this.buscarUsuario(id);
    await this.validarNoOrfandadAdmin(usuario, false, undefined);

    usuario.estaActivo = false;
    await this.usuarioRepository.save(usuario);
    await this.firebaseAdmin.actualizarUsuario(usuario.firebaseUid, {
      deshabilitado: true,
    });
  }

  private async buscarUsuario(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
      relations: { roles: { permisos: true } },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }

    return usuario;
  }

  private async obtenerRolesPorIds(rolIds: string[]): Promise<Rol[]> {
    await this.permisosSeed.asegurarCatalogoYRoles();
    const unicos = [...new Set(rolIds)];
    const roles = await this.rolRepository.find({
      where: { id: In(unicos) },
      relations: { permisos: true },
    });

    if (roles.length !== unicos.length) {
      throw new BadRequestException('Uno o más roles no existen');
    }

    return roles;
  }

  /**
   * Evita dejar el sistema sin ningún usuario activo con permiso roles.editar.
   */
  private async validarNoOrfandadAdmin(
    usuario: Usuario,
    estaActivoNuevo: boolean | undefined,
    rolesNuevos: Rol[] | undefined,
  ): Promise<void> {
    const quedaraActivo =
      estaActivoNuevo !== undefined ? estaActivoNuevo : usuario.estaActivo;
    const rolesFinales = rolesNuevos ?? usuario.roles ?? [];
    const teniaGestion = usuarioTienePermisos(usuario, ['roles.editar']);
    const tendraGestion = usuarioTienePermisos(
      { ...usuario, roles: rolesFinales } as Usuario,
      ['roles.editar'],
    );

    const pierdeGestion =
      teniaGestion && (!quedaraActivo || !tendraGestion);
    if (!pierdeGestion) return;

    const otros = await this.usuarioRepository.find({
      where: { estaActivo: true },
      relations: { roles: { permisos: true } },
    });
    const quedaAlguien = otros.some(
      (u) =>
        u.id !== usuario.id && usuarioTienePermisos(u, ['roles.editar']),
    );
    if (!quedaAlguien) {
      throw new BadRequestException(
        'Debe existir al menos un usuario activo con permiso para editar roles',
      );
    }
  }

  private verificarNoAutoDesactivacion(
    id: string,
    dto: ActualizarUsuarioDto,
    usuarioActual: Usuario,
  ): void {
    if (usuarioActual.id === id && dto.estaActivo === false) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta');
    }
  }
}
