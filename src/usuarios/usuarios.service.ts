import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
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
import { AlcanceTerritorialService } from './alcance-territorial.service';
import { PermisosSeedService } from './permisos-seed.service';
import {
  aRespuestaPaginadaUsuarios,
  aRespuestaUsuario,
} from './utils/serializar-usuario';
import {
  usuarioSoloJornadasAsignadas,
  usuarioTienePermisos,
} from './utils/permisos-usuario';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly permisosSeed: PermisosSeedService,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
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

    query.andWhere('usuario.eliminadoEn IS NULL');

    if (filtros.estaActivo !== undefined) {
      query.andWhere('usuario.estaActivo = :estaActivo', {
        estaActivo: filtros.estaActivo,
      });
    }

    const [usuarios, total] = await query
      .skip(skip)
      .take(limite)
      .getManyAndCount();
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

    const proyectoIds = [...new Set(dto.proyectoIds ?? [])];
    await this.asegurarProyectos(proyectoIds);
    if (proyectoIds.length) {
      const roles = await this.obtenerRolesPorIds(dto.rolIds);
      this.asegurarAsignacionManual({ roles } as Usuario);
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
      if (proyectoIds.length) {
        await this.reemplazarProyectosAsignados(guardado.id, proyectoIds);
      }
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

    await this.validarNoOrfandadAdmin(usuario, dto.estaActivo, rolesNuevos);

    await this.firebaseAdmin.actualizarUsuario(usuario.firebaseUid, {
      correo: dto.correo,
      contrasena: dto.contrasena,
      nombreCompleto: dto.nombreCompleto,
      deshabilitado: dto.estaActivo !== undefined ? !dto.estaActivo : undefined,
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

  async desactivar(
    id: string,
    usuarioActual: Usuario,
  ): Promise<RespuestaUsuarioDto> {
    if (usuarioActual.id === id) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta');
    }

    const usuario = await this.buscarUsuario(id);
    await this.validarNoOrfandadAdmin(usuario, false, undefined);

    usuario.estaActivo = false;
    await this.usuarioRepository.save(usuario);
    await this.firebaseAdmin.actualizarUsuario(usuario.firebaseUid, {
      deshabilitado: true,
    });
    return this.obtenerUno(id);
  }

  async reactivar(id: string): Promise<RespuestaUsuarioDto> {
    const usuario = await this.buscarUsuario(id);
    if (!usuario.estaActivo) {
      await this.firebaseAdmin.actualizarUsuario(usuario.firebaseUid, {
        deshabilitado: false,
      });
      usuario.estaActivo = true;
      await this.usuarioRepository.save(usuario);
    }
    return this.obtenerUno(id);
  }

  /**
   * Baja no reversible. El usuario desaparece del listado y pierde el acceso,
   * pero proyectos, jornadas y documentos conservan su nombre.
   */
  async eliminar(id: string, usuarioActual: Usuario): Promise<void> {
    if (usuarioActual.id === id) {
      throw new ForbiddenException('No puedes eliminar tu propia cuenta');
    }

    const usuario = await this.buscarUsuario(id);
    await this.validarNoOrfandadAdmin(usuario, false, []);

    const firebaseUid = usuario.firebaseUid;
    const correoPrevio = usuario.correo;
    const activoPrevio = usuario.estaActivo;
    const rolesPrevios = [...(usuario.roles ?? [])];

    usuario.estaActivo = false;
    usuario.eliminadoEn = new Date();
    usuario.correo = `eliminado.${usuario.id}@usuarios.invalid`;
    usuario.firebaseUid = `eliminado:${usuario.id}`;
    usuario.roles = [];

    await this.usuarioRepository.manager.transaction(async (manager) => {
      await manager.save(usuario);
      await this.desvincularMembresias(usuario.id, manager);
    });

    try {
      await this.borrarCuentaFirebase(firebaseUid);
    } catch (error) {
      usuario.estaActivo = activoPrevio;
      usuario.eliminadoEn = null;
      usuario.correo = correoPrevio;
      usuario.firebaseUid = firebaseUid;
      usuario.roles = rolesPrevios;
      await this.usuarioRepository.save(usuario);
      throw error;
    }
  }

  private async buscarUsuario(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
      relations: { roles: { permisos: true } },
    });

    if (!usuario || usuario.eliminadoEn) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }

    return usuario;
  }

  private async borrarCuentaFirebase(uid: string): Promise<void> {
    if (uid.startsWith('eliminado:')) return;
    try {
      await this.firebaseAdmin.eliminarUsuario(uid);
    } catch (error) {
      const codigo = (error as { code?: string }).code;
      if (codigo === 'auth/user-not-found') return;
      throw new BadRequestException(
        'No se pudo borrar el acceso de inicio de sesión. El usuario sigue en la plataforma.',
      );
    }
  }

  /** Lo saca de equipos y territorios. El historial (proyectos, jornadas, documentos) no se toca. */
  private async desvincularMembresias(
    usuarioId: string,
    manager: EntityManager,
  ): Promise<void> {
    const tablas = [
      'proyecto_personal',
      'jornada_equipo',
      'plantilla_formulario_usuarios',
      'usuario_alcance_territorial',
      'usuario_roles',
    ];
    for (const tabla of tablas) {
      await manager.query(`DELETE FROM ${tabla} WHERE usuario_id = $1`, [
        usuarioId,
      ]);
    }
  }

  /**
   * Proyectos a los que accede el usuario: los asignados como personal o,
   * si es técnico, los que salen de sus jornadas.
   */
  async listarProyectosAsignados(
    usuarioId: string,
  ): Promise<Array<{ id: string; nombre: string }>> {
    const usuario = await this.buscarUsuario(usuarioId);
    if (usuarioSoloJornadasAsignadas(usuario)) {
      const ids =
        await this.alcanceTerritorialService.idsProyectosPorJornadas(usuarioId);
      if (!ids.length) return [];
      return this.usuarioRepository.manager.query(
        `SELECT id, nombre FROM proyectos
         WHERE id = ANY($1::uuid[])
         ORDER BY nombre ASC`,
        [ids],
      );
    }
    return this.usuarioRepository.manager.query(
      `SELECT p.id, p.nombre
       FROM proyecto_personal pp
       JOIN proyectos p ON p.id = pp.proyecto_id
       WHERE pp.usuario_id = $1
       ORDER BY p.nombre ASC`,
      [usuarioId],
    );
  }

  /** Reemplaza la lista de proyectos donde el usuario es personal. */
  async reemplazarProyectosAsignados(
    usuarioId: string,
    proyectoIds: string[],
  ): Promise<Array<{ id: string; nombre: string }>> {
    const usuario = await this.buscarUsuario(usuarioId);
    this.asegurarAsignacionManual(usuario);
    const unicos = [...new Set(proyectoIds)];
    await this.asegurarProyectos(unicos);

    await this.usuarioRepository.manager.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM proyecto_personal WHERE usuario_id = $1`,
        [usuarioId],
      );
      if (unicos.length) {
        await manager.query(
          `INSERT INTO proyecto_personal (proyecto_id, usuario_id)
           SELECT unnest($1::uuid[]), $2
           ON CONFLICT DO NOTHING`,
          [unicos, usuarioId],
        );
      }
    });
    return this.listarProyectosAsignados(usuarioId);
  }

  /** Al técnico no se le asignan proyectos: salen de sus jornadas. */
  private asegurarAsignacionManual(usuario: Usuario): void {
    if (usuarioSoloJornadasAsignadas(usuario)) {
      throw new BadRequestException(
        'Los proyectos del técnico se toman automáticamente de sus jornadas asignadas',
      );
    }
  }

  private async asegurarProyectos(proyectoIds: string[]): Promise<void> {
    if (!proyectoIds.length) return;
    const filas: Array<{ id: string }> =
      await this.usuarioRepository.manager.query(
        `SELECT id FROM proyectos WHERE id = ANY($1::uuid[])`,
        [proyectoIds],
      );
    if (filas.length !== proyectoIds.length) {
      throw new BadRequestException('Uno o más proyectos no existen');
    }
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

    const pierdeGestion = teniaGestion && (!quedaraActivo || !tendraGestion);
    if (!pierdeGestion) return;

    const otros = await this.usuarioRepository.find({
      where: { estaActivo: true, eliminadoEn: IsNull() },
      relations: { roles: { permisos: true } },
    });
    const quedaAlguien = otros.some(
      (u) => u.id !== usuario.id && usuarioTienePermisos(u, ['roles.editar']),
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
