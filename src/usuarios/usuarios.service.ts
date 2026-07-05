import {
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
  RespuestaRolDto,
  RespuestaUsuarioDto,
} from './dto/respuesta-usuario.dto';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { NombreRol } from './enums/nombre-rol.enum';
import {
  aRespuestaPaginadaUsuarios,
  aRespuestaUsuario,
} from './utils/serializar-usuario';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  async listarRoles(): Promise<RespuestaRolDto[]> {
    await this.asegurarRolesBase();
    const roles = await this.rolRepository.find({ order: { nombre: 'ASC' } });
    return plainToInstance(RespuestaRolDto, roles, {
      excludeExtraneousValues: true,
    });
  }

  async listar(
    filtros: FiltrosUsuarioDto,
  ): Promise<RespuestaPaginadaUsuariosDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 10;
    const skip = (pagina - 1) * limite;

    const query = this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.roles', 'roles')
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
      const roles = await this.obtenerRolesPorNombre(dto.roles);
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

    if (dto.roles !== undefined) {
      usuario.roles = await this.obtenerRolesPorNombre(dto.roles);
    }

    await this.usuarioRepository.save(usuario);
    return this.obtenerUno(id);
  }

  async eliminar(id: string, usuarioActual: Usuario): Promise<void> {
    if (usuarioActual.id === id) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta');
    }

    const usuario = await this.buscarUsuario(id);
    usuario.estaActivo = false;
    await this.usuarioRepository.save(usuario);
    await this.firebaseAdmin.actualizarUsuario(usuario.firebaseUid, {
      deshabilitado: true,
    });
  }

  private async buscarUsuario(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
      relations: { roles: true },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }

    return usuario;
  }

  private async obtenerRolesPorNombre(nombres: NombreRol[]): Promise<Rol[]> {
    await this.asegurarRolesBase();
    const roles = await this.rolRepository.find({
      where: { nombre: In(nombres) },
    });

    if (roles.length !== nombres.length) {
      throw new NotFoundException('Uno o más roles no existen');
    }

    return roles;
  }

  private async asegurarRolesBase(): Promise<void> {
    for (const nombre of Object.values(NombreRol)) {
      const existe = await this.rolRepository.findOne({ where: { nombre } });
      if (!existe) {
        await this.rolRepository.save(this.rolRepository.create({ nombre }));
      }
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
