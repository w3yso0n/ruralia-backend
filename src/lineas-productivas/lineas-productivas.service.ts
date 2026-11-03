import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  RespuestaAdministracionLineasDto,
  RespuestaBeneficiarioLineaDto,
  RespuestaLineaProductivaDto,
  RespuestaLineaProyectoDto,
  RespuestaUnificarLineasDto,
} from './dto/linea-productiva.dto';
import { LineaProductiva } from './entities/linea-productiva.entity';
import {
  agruparPosiblesDuplicados,
  claveLineaProductiva,
  limpiarNombreLinea,
} from './utils/normalizar-linea';

const TAMANO_LOTE = 1000;

@Injectable()
export class LineasProductivasService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LineasProductivasService.name);

  constructor(
    @InjectRepository(LineaProductiva)
    private readonly lineaRepository: Repository<LineaProductiva>,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

  /**
   * Arma el catálogo a partir del texto que ya tienen los beneficiarios.
   * No modifica `beneficiarios.linea_productiva`: solo llena la FK nueva.
   * Si algo falla se registra y la plataforma arranca igual.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const enlazados = await this.vincularRegistrosExistentes();
      if (enlazados > 0) {
        this.logger.log(
          `Catálogo de líneas productivas: ${enlazados} beneficiarios enlazados`,
        );
      }
    } catch (error) {
      this.logger.error(
        'No se pudo armar el catálogo de líneas productivas a partir de los datos existentes',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Resolución nombre -> catálogo (usado por beneficiarios, Excel y subactividades)
  // ---------------------------------------------------------------------------

  /** Devuelve la línea del catálogo para ese nombre, creándola si no existe. */
  async asegurar(
    nombre: string | null | undefined,
    manager: EntityManager = this.lineaRepository.manager,
  ): Promise<LineaProductiva | null> {
    const clave = claveLineaProductiva(nombre);
    if (!clave) return null;
    const mapa = await this.asegurarClaves(
      new Map([[clave, limpiarNombreLinea(nombre)]]),
      manager,
    );
    return mapa.get(clave) ?? null;
  }

  /**
   * Recalcula la línea de esos beneficiarios a partir de su texto: crea las
   * líneas que falten, llena la FK y deja el texto igual al nombre del catálogo.
   * Una sola consulta de lectura y una de escritura por lote.
   */
  async sincronizarBeneficiarios(
    ids: Array<string | null | undefined>,
    manager: EntityManager = this.lineaRepository.manager,
  ): Promise<void> {
    const unicos = [...new Set(ids.filter((id): id is string => !!id))];
    for (let i = 0; i < unicos.length; i += TAMANO_LOTE) {
      const lote = unicos.slice(i, i + TAMANO_LOTE);
      const filas = await manager
        .createQueryBuilder(Beneficiario, 'b')
        .select(['b.id', 'b.lineaProductiva', 'b.lineaProductivaId'])
        .where('b.id IN (:...ids)', { ids: lote })
        .getMany();

      const nombres = new Map<string, string>();
      for (const fila of filas) {
        const clave = claveLineaProductiva(fila.lineaProductiva);
        if (clave && !nombres.has(clave)) {
          nombres.set(clave, limpiarNombreLinea(fila.lineaProductiva));
        }
      }
      const catalogo = await this.asegurarClaves(nombres, manager);

      const idsCambio: string[] = [];
      const lineasCambio: Array<string | null> = [];
      const textosCambio: Array<string | null> = [];
      for (const fila of filas) {
        const linea = catalogo.get(claveLineaProductiva(fila.lineaProductiva));
        const lineaId = linea?.id ?? null;
        const texto = linea?.nombre ?? null;
        if (
          fila.lineaProductivaId === lineaId &&
          fila.lineaProductiva === texto
        ) {
          continue;
        }
        idsCambio.push(fila.id);
        lineasCambio.push(lineaId);
        textosCambio.push(texto);
      }
      if (!idsCambio.length) continue;

      await manager.query(
        `
        UPDATE beneficiarios b
        SET linea_productiva_id = v.linea_id, linea_productiva = v.nombre
        FROM unnest($1::uuid[], $2::uuid[], $3::text[]) AS v(id, linea_id, nombre)
        WHERE b.id = v.id
        `,
        [idsCambio, lineasCambio, textosCambio],
      );
    }
  }

  /** Nombres del Excel que todavía no existen en el catálogo (para avisar antes de cargar). */
  async nombresNuevos(
    nombres: Array<string | null | undefined>,
  ): Promise<string[]> {
    const porClave = new Map<string, string>();
    for (const nombre of nombres) {
      const clave = claveLineaProductiva(nombre);
      if (clave && !porClave.has(clave))
        porClave.set(clave, limpiarNombreLinea(nombre));
    }
    if (!porClave.size) return [];
    const existentes = await this.lineaRepository.find({
      select: { clave: true },
      where: { clave: In([...porClave.keys()]) },
    });
    const conocidas = new Set(existentes.map((l) => l.clave));
    return [...porClave.entries()]
      .filter(([clave]) => !conocidas.has(clave))
      .map(([, nombre]) => nombre)
      .sort((a, b) => a.localeCompare(b, 'es'));
  }

  /** Marca las filas del Excel cuya línea todavía no existe (aviso en la revisión). */
  async marcarLineasNuevas<T extends { lineaProductiva?: string | null }>(
    filas: T[],
  ): Promise<Array<T & { lineaProductivaNueva?: boolean }>> {
    const nuevas = new Set(
      (await this.nombresNuevos(filas.map((f) => f.lineaProductiva))).map((n) =>
        claveLineaProductiva(n),
      ),
    );
    if (!nuevas.size) return filas;
    return filas.map((fila) =>
      nuevas.has(claveLineaProductiva(fila.lineaProductiva))
        ? { ...fila, lineaProductivaNueva: true }
        : fila,
    );
  }

  private async asegurarClaves(
    nombres: Map<string, string>,
    manager: EntityManager,
  ): Promise<Map<string, LineaProductiva>> {
    if (!nombres.size) return new Map();
    const claves = [...nombres.keys()];
    await manager
      .createQueryBuilder()
      .insert()
      .into(LineaProductiva)
      .values(claves.map((clave) => ({ clave, nombre: nombres.get(clave)! })))
      .orIgnore()
      .execute();
    const lineas = await manager.find(LineaProductiva, {
      where: { clave: In(claves) },
    });
    return new Map(lineas.map((l) => [l.clave, l]));
  }

  /**
   * Primer llenado del catálogo. Idempotente: solo toca beneficiarios con texto
   * y sin FK, y nunca cambia el texto original.
   */
  private async vincularRegistrosExistentes(): Promise<number> {
    const manager = this.lineaRepository.manager;
    const textos: Array<{ texto: string; total: number }> =
      await manager.query(`
      SELECT linea_productiva AS texto, COUNT(*)::int AS total
      FROM beneficiarios
      WHERE linea_productiva_id IS NULL
        AND btrim(COALESCE(linea_productiva, '')) <> ''
      GROUP BY linea_productiva
    `);
    if (!textos.length) return 0;

    // Por cada clave se queda la variante más usada como nombre visible.
    const mejores = new Map<string, { nombre: string; total: number }>();
    for (const { texto, total } of textos) {
      const clave = claveLineaProductiva(texto);
      if (!clave) continue;
      const actual = mejores.get(clave);
      if (!actual || total > actual.total) {
        mejores.set(clave, { nombre: limpiarNombreLinea(texto), total });
      }
    }
    const catalogo = await this.asegurarClaves(
      new Map([...mejores.entries()].map(([clave, v]) => [clave, v.nombre])),
      manager,
    );

    const pares = textos
      .map(({ texto }) => ({
        texto,
        lineaId: catalogo.get(claveLineaProductiva(texto))?.id,
      }))
      .filter((p): p is { texto: string; lineaId: string } => !!p.lineaId);
    if (!pares.length) return 0;

    const resultado: [unknown, number] = await manager.query(
      `
      UPDATE beneficiarios b
      SET linea_productiva_id = v.linea_id
      FROM unnest($1::text[], $2::uuid[]) AS v(texto, linea_id)
      WHERE b.linea_productiva_id IS NULL AND b.linea_productiva = v.texto
      `,
      [pares.map((p) => p.texto), pares.map((p) => p.lineaId)],
    );
    return Number(resultado?.[1] ?? 0);
  }

  // ---------------------------------------------------------------------------
  // Consulta para selectores
  // ---------------------------------------------------------------------------

  async buscar(
    busqueda?: string,
    limite = 20,
  ): Promise<RespuestaLineaProductivaDto[]> {
    const qb = this.lineaRepository
      .createQueryBuilder('l')
      .select(['l.id', 'l.nombre'])
      .orderBy('l.nombre', 'ASC')
      .take(Math.min(Math.max(limite, 1), 50));
    const clave = claveLineaProductiva(busqueda);
    if (clave) qb.where('l.clave LIKE :clave', { clave: `%${clave}%` });
    const lineas = await qb.getMany();
    return lineas.map((l) => ({ id: l.id, nombre: l.nombre }));
  }

  // ---------------------------------------------------------------------------
  // Por proyecto (Nueva jornada y selector de la subactividad)
  // ---------------------------------------------------------------------------

  /** Las líneas productivas solo se usan en proyectos agrícolas. */
  async esProyectoAgricola(proyectoId: string): Promise<boolean> {
    const [fila] = await this.lineaRepository.manager.query<
      Array<{ tipo: string }>
    >('SELECT tipo FROM proyectos WHERE id = $1', [proyectoId]);
    return fila?.tipo === 'AGRICOLA';
  }

  async listarDeProyecto(
    proyectoId: string,
    usuario: Usuario,
  ): Promise<RespuestaLineaProyectoDto[]> {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    if (!(await this.esProyectoAgricola(proyectoId))) return [];
    const filas: Array<{ id: string; nombre: string; beneficiarios: number }> =
      await this.lineaRepository.manager.query(
        `
        SELECT l.id, l.nombre, COUNT(*)::int AS beneficiarios
        FROM proyecto_beneficiarios pb
        JOIN beneficiarios b ON b.id = pb.beneficiario_id
        JOIN lineas_productivas l ON l.id = b.linea_productiva_id
        WHERE pb.proyecto_id = $1 AND pb.esta_activo_en_proyecto = true
        GROUP BY l.id, l.nombre
        ORDER BY beneficiarios DESC, l.nombre ASC
        `,
        [proyectoId],
      );
    return filas;
  }

  async beneficiariosDeLinea(
    proyectoId: string,
    lineaId: string,
    usuario: Usuario,
  ): Promise<RespuestaBeneficiarioLineaDto[]> {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    if (!(await this.esProyectoAgricola(proyectoId))) return [];
    return this.lineaRepository.manager.query(
      `
      SELECT b.id, b.nombres, b.apellidos, b.numero_documento AS "numeroDocumento"
      FROM proyecto_beneficiarios pb
      JOIN beneficiarios b ON b.id = pb.beneficiario_id
      WHERE pb.proyecto_id = $1
        AND pb.esta_activo_en_proyecto = true
        AND b.linea_productiva_id = $2
      ORDER BY b.apellidos ASC, b.nombres ASC
      `,
      [proyectoId, lineaId],
    );
  }

  /**
   * Líneas con beneficiarios del catálogo que todavía no están activos en el proyecto
   * (para sumarlos en lote desde Equipo y contraparte).
   */
  async listarDisponiblesParaProyecto(
    proyectoId: string,
    usuario: Usuario,
  ): Promise<RespuestaLineaProyectoDto[]> {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    if (!(await this.esProyectoAgricola(proyectoId))) return [];
    return this.lineaRepository.manager.query<RespuestaLineaProyectoDto[]>(
      `
      SELECT l.id, l.nombre, COUNT(*)::int AS beneficiarios
      FROM beneficiarios b
      JOIN lineas_productivas l ON l.id = b.linea_productiva_id
      WHERE b.eliminado_en IS NULL
        AND b.esta_activo = true
        AND NOT EXISTS (
          SELECT 1 FROM proyecto_beneficiarios pb
          WHERE pb.proyecto_id = $1
            AND pb.beneficiario_id = b.id
            AND (pb.esta_activo_en_proyecto = true OR pb.reemplazado_por_id IS NOT NULL)
        )
      GROUP BY l.id, l.nombre
      ORDER BY l.nombre ASC
      `,
      [proyectoId],
    );
  }

  /** Beneficiarios de una línea que se pueden sumar al proyecto. */
  async disponiblesDeLinea(
    proyectoId: string,
    lineaId: string,
    usuario: Usuario,
  ): Promise<RespuestaBeneficiarioLineaDto[]> {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    if (!(await this.esProyectoAgricola(proyectoId))) return [];
    return this.lineaRepository.manager.query<RespuestaBeneficiarioLineaDto[]>(
      `
      SELECT b.id, b.nombres, b.apellidos,
             b.numero_documento AS "numeroDocumento", b.municipio
      FROM beneficiarios b
      WHERE b.linea_productiva_id = $2
        AND b.eliminado_en IS NULL
        AND b.esta_activo = true
        AND NOT EXISTS (
          SELECT 1 FROM proyecto_beneficiarios pb
          WHERE pb.proyecto_id = $1
            AND pb.beneficiario_id = b.id
            AND (pb.esta_activo_en_proyecto = true OR pb.reemplazado_por_id IS NOT NULL)
        )
      ORDER BY b.apellidos ASC, b.nombres ASC
      `,
      [proyectoId, lineaId],
    );
  }

  // ---------------------------------------------------------------------------
  // Administración (permiso lineas_productivas.administrar)
  // ---------------------------------------------------------------------------

  async listarAdministracion(): Promise<RespuestaAdministracionLineasDto> {
    const manager = this.lineaRepository.manager;
    const [lineas, beneficiarios, subactividades] = await Promise.all([
      this.lineaRepository.find({ order: { nombre: 'ASC' } }),
      manager.query<Array<{ id: string; total: number }>>(`
        SELECT linea_productiva_id AS id, COUNT(*)::int AS total
        FROM beneficiarios
        WHERE linea_productiva_id IS NOT NULL AND eliminado_en IS NULL
        GROUP BY linea_productiva_id
      `),
      manager.query<Array<{ id: string; total: number }>>(`
        SELECT linea_productiva_id AS id, COUNT(*)::int AS total
        FROM subactividades
        WHERE linea_productiva_id IS NOT NULL AND esta_activo = true
        GROUP BY linea_productiva_id
      `),
    ]);

    const porBeneficiarios = new Map(beneficiarios.map((f) => [f.id, f.total]));
    const porSubactividades = new Map(
      subactividades.map((f) => [f.id, f.total]),
    );
    const datos = lineas.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      beneficiarios: porBeneficiarios.get(l.id) ?? 0,
      subactividades: porSubactividades.get(l.id) ?? 0,
    }));

    return {
      lineas: datos,
      posiblesDuplicados: agruparPosiblesDuplicados(datos).map((grupo) =>
        grupo.map((l) => l.id),
      ),
    };
  }

  async renombrar(
    id: string,
    nombre: string,
  ): Promise<RespuestaLineaProductivaDto> {
    const limpio = limpiarNombreLinea(nombre);
    const clave = claveLineaProductiva(limpio);
    if (!clave) throw new BadRequestException('Escribe el nombre de la línea');

    return this.lineaRepository.manager.transaction(async (manager) => {
      const linea = await manager.findOne(LineaProductiva, { where: { id } });
      if (!linea) throw new NotFoundException('La línea productiva no existe');

      const otra = await manager.findOne(LineaProductiva, { where: { clave } });
      if (otra && otra.id !== id) {
        throw new ConflictException(
          `Ya existe la línea «${otra.nombre}». Para juntarlas usa Unificar.`,
        );
      }

      linea.nombre = limpio;
      linea.clave = clave;
      await manager.save(linea);
      await manager.query(
        'UPDATE beneficiarios SET linea_productiva = $1 WHERE linea_productiva_id = $2',
        [limpio, id],
      );
      return { id: linea.id, nombre: linea.nombre };
    });
  }

  async unificar(
    destinoId: string,
    origenIds: string[],
  ): Promise<RespuestaUnificarLineasDto> {
    const origenes = [...new Set(origenIds)].filter((id) => id !== destinoId);
    if (!origenes.length) {
      throw new BadRequestException('Elige al menos otra línea para unificar');
    }

    return this.lineaRepository.manager.transaction(async (manager) => {
      const destino = await manager.findOne(LineaProductiva, {
        where: { id: destinoId },
      });
      if (!destino)
        throw new NotFoundException('La línea que se conserva no existe');
      const encontradas = await manager.count(LineaProductiva, {
        where: { id: In(origenes) },
      });
      if (encontradas !== origenes.length) {
        throw new NotFoundException(
          'Alguna de las líneas a unificar ya no existe',
        );
      }

      const [, beneficiarios]: [unknown, number] = await manager.query(
        `
        UPDATE beneficiarios
        SET linea_productiva_id = $1, linea_productiva = $2
        WHERE linea_productiva_id = ANY($3::uuid[]) AND eliminado_en IS NULL
        `,
        [destino.id, destino.nombre, origenes],
      );
      const [, subactividades]: [unknown, number] = await manager.query(
        `
        UPDATE subactividades
        SET linea_productiva_id = $1
        WHERE linea_productiva_id = ANY($2::uuid[])
        `,
        [destino.id, origenes],
      );
      await manager.delete(LineaProductiva, { id: In(origenes) });

      return {
        linea: { id: destino.id, nombre: destino.nombre },
        beneficiariosActualizados: Number(beneficiarios ?? 0),
        subactividadesActualizadas: Number(subactividades ?? 0),
      };
    });
  }

  async eliminar(id: string): Promise<void> {
    const manager = this.lineaRepository.manager;
    const [linea, usos] = await Promise.all([
      this.lineaRepository.findOne({ where: { id } }),
      manager.query<Array<{ beneficiarios: number; subactividades: number }>>(
        `
        SELECT
          (SELECT COUNT(*) FROM beneficiarios WHERE linea_productiva_id = $1)::int AS beneficiarios,
          (SELECT COUNT(*) FROM subactividades WHERE linea_productiva_id = $1)::int AS subactividades
        `,
        [id],
      ),
    ]);
    if (!linea) throw new NotFoundException('La línea productiva no existe');
    const { beneficiarios = 0, subactividades = 0 } = usos[0] ?? {};
    if (beneficiarios > 0 || subactividades > 0) {
      throw new ConflictException(
        'La línea todavía tiene beneficiarios o subactividades. Unifícala con otra en lugar de eliminarla.',
      );
    }
    await this.lineaRepository.delete({ id });
  }
}
