import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Departamento } from '../territorios/entities/departamento.entity';
import { Municipio } from '../territorios/entities/municipio.entity';
import { Region } from '../territorios/entities/region.entity';
import { Vereda } from '../territorios/entities/vereda.entity';
import { TipoAlcanceTerritorial } from './enums/tipo-alcance-territorial.enum';
import { UsuarioAlcanceTerritorial } from './entities/usuario-alcance-territorial.entity';
import { Usuario } from './entities/usuario.entity';
import {
  usuarioEsCoordinacion,
  usuarioTieneAccesoTotal,
} from './utils/permisos-usuario';

export interface ItemAlcanceTerritorial {
  tipo: TipoAlcanceTerritorial;
  referenciaId: string;
  nombre?: string;
}

@Injectable()
export class AlcanceTerritorialService {
  constructor(
    @InjectRepository(UsuarioAlcanceTerritorial)
    private readonly alcanceRepository: Repository<UsuarioAlcanceTerritorial>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(Region)
    private readonly regionRepository: Repository<Region>,
    @InjectRepository(Departamento)
    private readonly departamentoRepository: Repository<Departamento>,
    @InjectRepository(Municipio)
    private readonly municipioRepository: Repository<Municipio>,
    @InjectRepository(Vereda)
    private readonly veredaRepository: Repository<Vereda>,
  ) {}

  /**
   * null = ve todos los proyectos.
   * Lista (aunque vacía) = solo esos ids.
   */
  async idsProyectosVisibles(usuario: Usuario): Promise<string[] | null> {
    if (usuarioTieneAccesoTotal(usuario)) return null;

    if (usuarioEsCoordinacion(usuario)) {
      return this.idsProyectosPorAlcance(usuario.id);
    }

    const filas: Array<{ proyecto_id: string }> =
      await this.proyectoRepository.manager.query(
        `SELECT proyecto_id FROM proyecto_personal WHERE usuario_id = $1`,
        [usuario.id],
      );
    return filas.map((fila) => fila.proyecto_id);
  }

  async assertProyectoVisible(
    usuario: Usuario,
    proyectoId: string,
  ): Promise<void> {
    const visibles = await this.idsProyectosVisibles(usuario);
    if (visibles === null) return;
    if (!visibles.includes(proyectoId)) {
      throw new ForbiddenException('No tiene acceso a este proyecto');
    }
  }

  /**
   * Acceso total: cualquier proyecto.
   * Coordinación: proyectos de su territorio o de su equipo.
   * Resto: nunca gestiona, aunque tenga el permiso de la matriz.
   */
  async puedeGestionarProyecto(
    usuario: Usuario,
    proyectoId: string,
  ): Promise<boolean> {
    if (usuarioTieneAccesoTotal(usuario)) return true;
    if (!usuarioEsCoordinacion(usuario)) return false;

    const enTerritorio = await this.idsProyectosPorAlcance(usuario.id);
    if (enTerritorio.includes(proyectoId)) return true;

    const filas: Array<{ existe: number }> =
      await this.proyectoRepository.manager.query(
        `SELECT 1 AS existe FROM proyecto_personal
         WHERE proyecto_id = $1 AND usuario_id = $2 LIMIT 1`,
        [proyectoId, usuario.id],
      );
    return filas.length > 0;
  }

  async assertPuedeGestionarProyecto(
    usuario: Usuario,
    proyectoId: string,
  ): Promise<void> {
    if (await this.puedeGestionarProyecto(usuario, proyectoId)) return;
    throw new ForbiddenException(
      usuarioEsCoordinacion(usuario)
        ? 'Este proyecto no está en tu territorio ni en tu equipo'
        : 'Tu rol no puede gestionar proyectos',
    );
  }

  async listar(usuarioId: string): Promise<ItemAlcanceTerritorial[]> {
    await this.asegurarUsuario(usuarioId);
    const filas = await this.alcanceRepository.find({
      where: { usuarioId },
      order: { tipo: 'ASC' },
    });
    const conNombre = await Promise.all(
      filas.map(async (fila) => ({
        tipo: fila.tipo,
        referenciaId: fila.referenciaId,
        nombre: await this.nombreNodo(fila.tipo, fila.referenciaId),
      })),
    );
    return conNombre;
  }

  async reemplazar(
    usuarioId: string,
    items: Array<{ tipo: TipoAlcanceTerritorial; referenciaId: string }>,
  ): Promise<ItemAlcanceTerritorial[]> {
    const usuario = await this.asegurarUsuario(usuarioId);
    const unicos = new Map<string, ItemAlcanceTerritorial>();
    for (const item of items) {
      await this.asegurarNodo(item.tipo, item.referenciaId);
      unicos.set(`${item.tipo}:${item.referenciaId}`, item);
    }

    await this.alcanceRepository
      .createQueryBuilder()
      .delete()
      .from(UsuarioAlcanceTerritorial)
      .where('usuario_id = :usuarioId', { usuarioId })
      .execute();
    if (unicos.size) {
      await this.alcanceRepository.save(
        [...unicos.values()].map((item) =>
          this.alcanceRepository.create({
            usuarioId: usuario.id,
            tipo: item.tipo,
            referenciaId: item.referenciaId,
          }),
        ),
      );
    }
    return this.listar(usuarioId);
  }

  private async idsProyectosPorAlcance(usuarioId: string): Promise<string[]> {
    const asignaciones = await this.alcanceRepository.find({
      where: { usuarioId },
    });
    if (!asignaciones.length) return [];

    const porTipo = (tipo: TipoAlcanceTerritorial) =>
      asignaciones
        .filter((item) => item.tipo === tipo)
        .map((item) => item.referenciaId);

    const regiones = porTipo(TipoAlcanceTerritorial.REGION);
    const departamentos = porTipo(TipoAlcanceTerritorial.DEPARTAMENTO);
    const municipios = porTipo(TipoAlcanceTerritorial.MUNICIPIO);
    const veredas = porTipo(TipoAlcanceTerritorial.VEREDA);

    const condiciones: string[] = [];
    const params: unknown[] = [];
    const agregar = (sql: string, ids: string[]) => {
      if (!ids.length) return;
      params.push(ids);
      condiciones.push(sql.replace('$?', `$${params.length}`));
    };
    agregar('d.region_id = ANY($?::uuid[])', regiones);
    agregar('d.id = ANY($?::uuid[])', departamentos);
    agregar('m.id = ANY($?::uuid[])', municipios);
    agregar('v.id = ANY($?::uuid[])', veredas);
    if (!condiciones.length) return [];

    const filas: Array<{ proyecto_id: string }> =
      await this.proyectoRepository.manager.query(
        `SELECT DISTINCT pv.proyecto_id
         FROM proyecto_veredas pv
         JOIN veredas v ON v.id = pv.vereda_id
         JOIN municipios m ON m.id = v.municipio_id
         JOIN departamentos d ON d.id = m.departamento_id
         WHERE ${condiciones.join(' OR ')}`,
        params,
      );
    return filas.map((fila) => fila.proyecto_id);
  }

  private async asegurarUsuario(usuarioId: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);
    }
    return usuario;
  }

  private async asegurarNodo(
    tipo: TipoAlcanceTerritorial,
    referenciaId: string,
  ): Promise<void> {
    const existe = await this.nombreNodo(tipo, referenciaId);
    if (!existe) {
      throw new BadRequestException(
        `No existe ${tipo.toLowerCase()} ${referenciaId}`,
      );
    }
  }

  private async nombreNodo(
    tipo: TipoAlcanceTerritorial,
    referenciaId: string,
  ): Promise<string | undefined> {
    if (tipo === TipoAlcanceTerritorial.REGION) {
      const nodo = await this.regionRepository.findOne({
        where: { id: referenciaId },
      });
      return nodo?.nombre;
    }
    if (tipo === TipoAlcanceTerritorial.DEPARTAMENTO) {
      const nodo = await this.departamentoRepository.findOne({
        where: { id: referenciaId },
      });
      return nodo?.nombre;
    }
    if (tipo === TipoAlcanceTerritorial.MUNICIPIO) {
      const nodo = await this.municipioRepository.findOne({
        where: { id: referenciaId },
      });
      return nodo?.nombre;
    }
    const nodo = await this.veredaRepository.findOne({
      where: { id: referenciaId },
    });
    return nodo?.nombre;
  }
}
