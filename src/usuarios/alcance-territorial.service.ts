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
import { NivelAccesoRol } from './enums/nivel-acceso-rol.enum';
import {
  nivelAccesoUsuario,
  usuarioEsCoordinacion,
  usuarioSoloJornadasAsignadas,
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

    if (usuarioSoloJornadasAsignadas(usuario)) {
      return this.idsProyectosPorJornadas(usuario.id);
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
   * El técnico solo accede a lo que cuelga de sus jornadas (documentos,
   * envíos, evidencias, rechazos). Para el resto de niveles no restringe.
   */
  async assertTecnicoEnJornada(
    usuario: Usuario,
    jornadaId: string | null | undefined,
  ): Promise<void> {
    if (!usuarioSoloJornadasAsignadas(usuario)) return;
    const filas: Array<{ existe: number }> = jornadaId
      ? await this.proyectoRepository.manager.query(
          `SELECT 1 AS existe FROM jornadas j
           WHERE j.id = $1
             AND (j.tecnico_responsable_id = $2
               OR EXISTS (SELECT 1 FROM jornada_equipo je
                          WHERE je.jornada_id = j.id AND je.usuario_id = $2))
           LIMIT 1`,
          [jornadaId, usuario.id],
        )
      : [];
    if (!filas.length) {
      throw new ForbiddenException('No tiene acceso a esta jornada');
    }
  }

  /** Igual que assertTecnicoEnJornada, partiendo de una fila con jornada_id. */
  async assertTecnicoEnRegistroDeJornada(
    usuario: Usuario,
    tabla: 'documents' | 'envios_formulario' | 'evidencias',
    registroId: string,
  ): Promise<void> {
    if (!usuarioSoloJornadasAsignadas(usuario)) return;
    const filas: Array<{ jornada_id: string | null }> =
      await this.proyectoRepository.manager.query(
        `SELECT jornada_id FROM ${tabla} WHERE id = $1`,
        [registroId],
      );
    await this.assertTecnicoEnJornada(usuario, filas[0]?.jornada_id);
  }

  /**
   * Datos de proyecto más allá de la ficha básica (estadísticas, territorio,
   * historial de beneficiarios). El técnico nunca los consulta.
   */
  async assertConsultaCompletaProyecto(
    usuario: Usuario,
    proyectoId: string,
  ): Promise<void> {
    if (usuarioSoloJornadasAsignadas(usuario)) {
      throw new ForbiddenException(
        'Tu rol solo consulta la información de tus jornadas',
      );
    }
    await this.assertProyectoVisible(usuario, proyectoId);
  }

  /**
   * Según el nivel de acceso del rol:
   * - TOTAL: cualquier proyecto.
   * - TERRITORIAL: proyectos de su territorio o de su equipo.
   * - PROYECTOS_ASIGNADOS: solo proyectos donde está en el personal.
   * - JORNADAS_ASIGNADAS: nunca gestiona, aunque tenga el permiso de la matriz.
   */
  async puedeGestionarProyecto(
    usuario: Usuario,
    proyectoId: string,
  ): Promise<boolean> {
    const nivel = nivelAccesoUsuario(usuario);
    if (nivel === NivelAccesoRol.TOTAL) return true;
    if (nivel === NivelAccesoRol.JORNADAS_ASIGNADAS) return false;

    if (nivel === NivelAccesoRol.TERRITORIAL) {
      const enTerritorio = await this.idsProyectosPorAlcance(usuario.id);
      if (enTerritorio.includes(proyectoId)) return true;
    }

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
    const nivel = nivelAccesoUsuario(usuario);
    throw new ForbiddenException(
      nivel === NivelAccesoRol.TERRITORIAL
        ? 'Este proyecto no está en tu territorio ni en tu equipo'
        : nivel === NivelAccesoRol.PROYECTOS_ASIGNADOS
          ? 'No estás asignado a este proyecto'
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

  /**
   * Técnico: los proyectos salen solos de las jornadas donde es responsable
   * o parte del equipo (sin contar las canceladas). No se asignan a mano.
   */
  async idsProyectosPorJornadas(usuarioId: string): Promise<string[]> {
    const filas: Array<{ proyecto_id: string }> =
      await this.proyectoRepository.manager.query(
        `SELECT DISTINCT j.proyecto_id
         FROM jornadas j
         WHERE j.estado <> 'CANCELADA'
           AND (j.tecnico_responsable_id = $1
             OR EXISTS (SELECT 1 FROM jornada_equipo je
                        WHERE je.jornada_id = j.id AND je.usuario_id = $1))`,
        [usuarioId],
      );
    return filas.map((fila) => fila.proyecto_id);
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

    // Condiciones de región, departamento y municipio: aplican tanto a las
    // veredas del proyecto como a los municipios que tiene sin vereda.
    const condiciones: string[] = [];
    const params: unknown[] = [];
    const agregar = (destino: string[], sql: string, ids: string[]) => {
      if (!ids.length) return;
      params.push(ids);
      destino.push(sql.replace('$?', `$${params.length}`));
    };
    agregar(condiciones, 'd.region_id = ANY($?::uuid[])', regiones);
    agregar(condiciones, 'd.id = ANY($?::uuid[])', departamentos);
    agregar(condiciones, 'm.id = ANY($?::uuid[])', municipios);
    // Una vereda asignada solo cubre proyectos que tengan esa vereda, no
    // todo el municipio que la contiene.
    const condicionesVereda = [...condiciones];
    agregar(condicionesVereda, 'v.id = ANY($?::uuid[])', veredas);
    if (!condicionesVereda.length) return [];

    const consultas = [
      `SELECT pv.proyecto_id
       FROM proyecto_veredas pv
       JOIN veredas v ON v.id = pv.vereda_id
       JOIN municipios m ON m.id = v.municipio_id
       JOIN departamentos d ON d.id = m.departamento_id
       WHERE ${condicionesVereda.join(' OR ')}`,
    ];
    if (condiciones.length) {
      consultas.push(
        `SELECT pm.proyecto_id
         FROM proyecto_municipios pm
         JOIN municipios m ON m.id = pm.municipio_id
         JOIN departamentos d ON d.id = m.departamento_id
         WHERE ${condiciones.join(' OR ')}`,
      );
    }

    const filas: Array<{ proyecto_id: string }> =
      await this.proyectoRepository.manager.query(
        consultas.join(' UNION '),
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
