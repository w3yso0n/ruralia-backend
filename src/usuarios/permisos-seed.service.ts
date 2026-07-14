import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CATALOGO_PERMISOS,
  DESCRIPCIONES_ROL_SISTEMA,
  MIGRACION_NOMBRES_ROL_LEGACY,
  PERMISOS_CRITICOS_CUANTIVA,
  PERMISOS_POR_ROL_SISTEMA,
  RolSistema,
} from './catalogo-permisos';
import { Permiso } from './entities/permiso.entity';
import { Rol } from './entities/rol.entity';

@Injectable()
export class PermisosSeedService implements OnModuleInit {
  private readonly logger = new Logger(PermisosSeedService.name);

  constructor(
    @InjectRepository(Permiso)
    private readonly permisoRepository: Repository<Permiso>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.asegurarCatalogoYRoles();
  }

  async asegurarCatalogoYRoles(): Promise<void> {
    await this.asegurarPermisos();
    await this.migrarNombresRolesLegacy();
    await this.asegurarRolesSistema();
    await this.asegurarPermisosCriticosCuantiva();
  }

  private async asegurarPermisos(): Promise<void> {
    for (const def of CATALOGO_PERMISOS) {
      const existente = await this.permisoRepository.findOne({
        where: { clave: def.clave },
      });
      if (existente) {
        existente.modulo = def.modulo;
        existente.accion = def.accion;
        existente.descripcion = def.descripcion;
        existente.orden = def.orden;
        await this.permisoRepository.save(existente);
      } else {
        await this.permisoRepository.save(
          this.permisoRepository.create({
            clave: def.clave,
            modulo: def.modulo,
            accion: def.accion,
            descripcion: def.descripcion,
            orden: def.orden,
          }),
        );
      }
    }
  }

  private async migrarNombresRolesLegacy(): Promise<void> {
    for (const [legacy, canonico] of Object.entries(
      MIGRACION_NOMBRES_ROL_LEGACY,
    )) {
      const rolLegacy = await this.rolRepository.findOne({
        where: { nombre: legacy },
      });
      if (!rolLegacy) continue;

      const yaExisteCanonico = await this.rolRepository.findOne({
        where: { nombre: canonico },
      });
      if (yaExisteCanonico) {
        this.logger.warn(
          `Rol legacy ${legacy} encontrado pero ya existe ${canonico}; no se renombra automáticamente`,
        );
        continue;
      }

      rolLegacy.nombre = canonico;
      rolLegacy.esSistema = true;
      rolLegacy.descripcion =
        DESCRIPCIONES_ROL_SISTEMA[canonico] ?? rolLegacy.descripcion;
      await this.rolRepository.save(rolLegacy);
      this.logger.log(`Rol legacy renombrado: ${legacy} → ${canonico}`);
    }
  }

  private async asegurarRolesSistema(): Promise<void> {
    const todos = await this.permisoRepository.find();
    const porClave = new Map(todos.map((p) => [p.clave, p]));

    for (const nombre of Object.values(RolSistema)) {
      let rol = await this.rolRepository.findOne({
        where: { nombre },
        relations: { permisos: true },
      });

      if (!rol) {
        rol = this.rolRepository.create({
          nombre,
          descripcion: DESCRIPCIONES_ROL_SISTEMA[nombre],
          esSistema: true,
          estaActivo: true,
          permisos: [],
        });
      } else {
        rol.esSistema = true;
        rol.descripcion =
          DESCRIPCIONES_ROL_SISTEMA[nombre] ?? rol.descripcion;
      }

      const esNuevo = !rol.id;
      const sinPermisos =
        !esNuevo && (!rol.permisos || rol.permisos.length === 0);
      const esCuantiva = nombre === RolSistema.CUANTIVA;
      // Cuantiva siempre se re-sincroniza con el catálogo completo.
      if (esNuevo || sinPermisos || esCuantiva) {
        const preset = PERMISOS_POR_ROL_SISTEMA[nombre];
        const claves =
          preset === 'ALL' ? todos.map((p) => p.clave) : [...preset];
        rol.permisos = claves
          .map((c) => porClave.get(c))
          .filter((p): p is Permiso => !!p);
      }

      await this.rolRepository.save(rol);
    }
  }

  private async asegurarPermisosCriticosCuantiva(): Promise<void> {
    const cuantiva = await this.rolRepository.findOne({
      where: { nombre: RolSistema.CUANTIVA },
      relations: { permisos: true },
    });
    if (!cuantiva) {
      this.logger.error('Rol CUANTIVA no encontrado tras el seed');
      return;
    }

    const criticos = await this.permisoRepository.find({
      where: { clave: In([...PERMISOS_CRITICOS_CUANTIVA]) },
    });
    const actuales = new Set((cuantiva.permisos ?? []).map((p) => p.clave));
    const faltantes = criticos.filter((p) => !actuales.has(p.clave));

    if (faltantes.length) {
      cuantiva.permisos = [...(cuantiva.permisos ?? []), ...faltantes];
      await this.rolRepository.save(cuantiva);
      this.logger.warn(
        `Re-adjuntados permisos críticos de CUANTIVA: ${faltantes
          .map((p) => p.clave)
          .join(', ')}`,
      );
    }
  }
}
