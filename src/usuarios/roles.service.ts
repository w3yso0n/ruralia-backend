import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CATALOGO_PERMISOS, RolSistema } from './catalogo-permisos';
import { Usuario } from './entities/usuario.entity';
import { usuarioEsCuantiva } from './utils/permisos-usuario';
import { NivelAccesoRol } from './enums/nivel-acceso-rol.enum';
import { ActualizarRolDto } from './dto/actualizar-rol.dto';
import { CrearRolDto } from './dto/crear-rol.dto';
import {
  RespuestaModuloPermisosDto,
  RespuestaPermisoDto,
  RespuestaRolDetalleDto,
} from './dto/respuesta-rol.dto';
import { Permiso } from './entities/permiso.entity';
import { Rol } from './entities/rol.entity';
import { PermisosSeedService } from './permisos-seed.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    @InjectRepository(Permiso)
    private readonly permisoRepository: Repository<Permiso>,
    private readonly permisosSeed: PermisosSeedService,
  ) {}

  async listarPermisosAgrupados(): Promise<RespuestaModuloPermisosDto[]> {
    await this.permisosSeed.asegurarCatalogoYRoles();
    const permisos = await this.permisoRepository.find({
      order: { orden: 'ASC', clave: 'ASC' },
    });

    const porModulo = new Map<string, RespuestaPermisoDto[]>();
    for (const p of permisos) {
      const lista = porModulo.get(p.modulo) ?? [];
      lista.push({
        id: p.id,
        clave: p.clave,
        modulo: p.modulo,
        accion: p.accion,
        descripcion: p.descripcion,
        orden: p.orden,
      });
      porModulo.set(p.modulo, lista);
    }

    return [...porModulo.entries()].map(([modulo, items]) => ({
      modulo,
      permisos: items,
    }));
  }

  async listar(actor: Usuario): Promise<RespuestaRolDetalleDto[]> {
    await this.permisosSeed.asegurarCatalogoYRoles();
    const roles = await this.rolRepository.find({
      relations: { permisos: true, usuarios: true },
      order: { nombre: 'ASC' },
    });
    return roles
      .filter((rol) => this.puedeVerRol(actor, rol))
      .map((rol) => this.aDetalle(rol));
  }

  async obtenerUno(id: string, actor: Usuario): Promise<RespuestaRolDetalleDto> {
    const rol = await this.buscarRol(id);
    this.assertPuedeVerRol(actor, rol);
    return this.aDetalle(rol);
  }

  async crear(dto: CrearRolDto): Promise<RespuestaRolDetalleDto> {
    const nombre = dto.nombre.trim();
    const existente = await this.rolRepository.findOne({ where: { nombre } });
    if (existente) {
      throw new ConflictException('Ya existe un rol con ese nombre');
    }

    const permisos = await this.obtenerPermisosPorIds(dto.permisoIds ?? []);
    this.assertPermisoAprobacionesPermitido(nombre, permisos);
    const rol = this.rolRepository.create({
      nombre,
      descripcion: dto.descripcion,
      esSistema: false,
      estaActivo: true,
      nivelAcceso: dto.nivelAcceso ?? NivelAccesoRol.PROYECTOS_ASIGNADOS,
      permisos,
    });
    const guardado = await this.rolRepository.save(rol);
    return this.aDetalle(await this.buscarRol(guardado.id));
  }

  async actualizar(
    id: string,
    dto: ActualizarRolDto,
    actor: Usuario,
  ): Promise<RespuestaRolDetalleDto> {
    const rol = await this.buscarRol(id);
    this.assertPuedeVerRol(actor, rol);

    if (dto.nombre !== undefined) {
      const nuevoNombre = dto.nombre.trim();
      if (rol.esSistema && nuevoNombre !== rol.nombre) {
        throw new BadRequestException(
          'No se puede renombrar un rol de sistema',
        );
      }
      if (nuevoNombre !== rol.nombre) {
        const duplicado = await this.rolRepository.findOne({
          where: { nombre: nuevoNombre },
        });
        if (duplicado) {
          throw new ConflictException('Ya existe un rol con ese nombre');
        }
        rol.nombre = nuevoNombre;
      }
    }

    if (dto.descripcion !== undefined) {
      rol.descripcion = dto.descripcion;
    }

    if (dto.estaActivo !== undefined) {
      if (rol.nombre === RolSistema.CUANTIVA && dto.estaActivo === false) {
        throw new BadRequestException('No se puede desactivar el rol CUANTIVA');
      }
      rol.estaActivo = dto.estaActivo;
    }

    if (dto.nivelAcceso !== undefined && dto.nivelAcceso !== rol.nivelAcceso) {
      if (rol.esSistema) {
        throw new BadRequestException(
          'El nivel de acceso de un rol de sistema no se puede cambiar. Clónalo para crear una variante.',
        );
      }
      rol.nivelAcceso = dto.nivelAcceso;
    }

    if (dto.permisoIds !== undefined) {
      const permisos = await this.obtenerPermisosPorIds(dto.permisoIds);
      if (rol.nombre === RolSistema.ADMINISTRADOR) {
        const cadena = await this.permisoRepository.findOne({
          where: { clave: 'proyectos.configurar_aprobaciones' },
        });
        if (cadena && !permisos.some((p) => p.id === cadena.id)) {
          permisos.push(cadena);
        }
      }
      this.validarPermisosCriticosCuantiva(rol, permisos);
      this.assertPermisoAprobacionesPermitido(rol.nombre, permisos);
      rol.permisos = permisos;
    }

    await this.rolRepository.save(rol);
    return this.aDetalle(await this.buscarRol(id));
  }

  async eliminar(id: string, actor: Usuario): Promise<void> {
    const rol = await this.buscarRol(id);
    this.assertPuedeVerRol(actor, rol);
    if (rol.nombre === RolSistema.CUANTIVA) {
      throw new BadRequestException('Nadie puede eliminar el rol Cuantiva');
    }
    if (rol.esSistema) {
      throw new BadRequestException('No se puede eliminar un rol de sistema');
    }
    if ((rol.usuarios?.length ?? 0) > 0) {
      throw new BadRequestException(
        'No se puede eliminar un rol que tiene usuarios asignados',
      );
    }
    await this.rolRepository.remove(rol);
  }

  /** Aplica el preset de fábrica del rol de sistema, deshaciendo ediciones manuales. */
  async restablecerAValoresDeFabrica(
    id: string,
    actor: Usuario,
  ): Promise<RespuestaRolDetalleDto> {
    const rol = await this.buscarRol(id);
    this.assertPuedeVerRol(actor, rol);
    await this.permisosSeed.restablecerRolAValoresDeFabrica(id);
    return this.aDetalle(await this.buscarRol(id));
  }

  async clonar(id: string, actor: Usuario): Promise<RespuestaRolDetalleDto> {
    const original = await this.buscarRol(id);
    this.assertPuedeVerRol(actor, original);
    if (original.nombre === RolSistema.CUANTIVA) {
      throw new ForbiddenException('No se puede clonar el rol Cuantiva');
    }
    const nombre = await this.generarNombreCopia(original.nombre);
    return this.crear({
      nombre,
      descripcion: original.descripcion ?? undefined,
      nivelAcceso: original.nivelAcceso,
      permisoIds: (original.permisos ?? [])
        .filter((p) => p.clave !== 'proyectos.configurar_aprobaciones')
        .map((p) => p.id),
    });
  }

  private async generarNombreCopia(nombreOriginal: string): Promise<string> {
    const maxLen = 80;
    const base = `${nombreOriginal}_COPIA`.slice(0, maxLen);
    let candidato = base;
    let intento = 2;

    while (await this.rolRepository.findOne({ where: { nombre: candidato } })) {
      const sufijo = `_COPIA_${intento}`;
      const prefijo = nombreOriginal.slice(
        0,
        Math.max(1, maxLen - sufijo.length),
      );
      candidato = `${prefijo}${sufijo}`;
      intento += 1;
      if (intento > 100) {
        throw new ConflictException(
          'No se pudo generar un nombre único para el rol clonado',
        );
      }
    }

    return candidato;
  }

  private validarPermisosCriticosCuantiva(rol: Rol, permisos: Permiso[]): void {
    if (rol.nombre !== RolSistema.CUANTIVA) return;
    const claves = new Set(permisos.map((p) => p.clave));
    const faltantes = CATALOGO_PERMISOS.map((p) => p.clave).filter(
      (clave) => !claves.has(clave),
    );
    if (faltantes.length) {
      throw new BadRequestException(
        'El rol Cuantiva no puede perder permisos',
      );
    }
  }

  private assertPermisoAprobacionesPermitido(
    nombreRol: string,
    permisos: Permiso[],
  ): void {
    const loTiene = permisos.some(
      (p) => p.clave === 'proyectos.configurar_aprobaciones',
    );
    if (!loTiene) return;
    if (
      nombreRol === RolSistema.CUANTIVA ||
      nombreRol === RolSistema.ADMINISTRADOR
    ) {
      return;
    }
    throw new BadRequestException(
      'Configurar aprobaciones solo puede estar en Administrador y Cuantiva',
    );
  }

  private puedeVerRol(actor: Usuario, rol: Rol): boolean {
    if (rol.nombre !== RolSistema.CUANTIVA) return true;
    return usuarioEsCuantiva(actor);
  }

  private assertPuedeVerRol(actor: Usuario, rol: Rol): void {
    if (!this.puedeVerRol(actor, rol)) {
      throw new NotFoundException(`Rol con id ${rol.id} no encontrado`);
    }
  }

  private async obtenerPermisosPorIds(ids: string[]): Promise<Permiso[]> {
    if (!ids.length) return [];
    const unicos = [...new Set(ids)];
    const permisos = await this.permisoRepository.find({
      where: { id: In(unicos) },
    });
    if (permisos.length !== unicos.length) {
      throw new BadRequestException('Uno o más permisos no existen');
    }
    return permisos;
  }

  private async buscarRol(id: string): Promise<Rol> {
    const rol = await this.rolRepository.findOne({
      where: { id },
      relations: { permisos: true, usuarios: true },
    });
    if (!rol) {
      throw new NotFoundException(`Rol con id ${id} no encontrado`);
    }
    return rol;
  }

  private aDetalle(rol: Rol): RespuestaRolDetalleDto {
    const permisoIds = (rol.permisos ?? []).map((p) => p.id);
    const permisoClaves = (rol.permisos ?? []).map((p) => p.clave).sort();
    return {
      id: rol.id,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      esSistema: rol.esSistema,
      estaActivo: rol.estaActivo,
      nivelAcceso: rol.nivelAcceso,
      permisoIds,
      permisoClaves,
      conteoPermisos: permisoClaves.length,
      conteoUsuarios: rol.usuarios?.length ?? 0,
    };
  }
}
