import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { HistorialDatoBeneficiario } from '../beneficiarios/entities/historial-dato-beneficiario.entity';
import { TipoDocumento } from '../beneficiarios/enums/tipo-documento.enum';
import { MENSAJE_DOCUMENTO_ELIMINADO } from '../beneficiarios/utils/mensajes-beneficiario';
import { CronologiaService } from '../cronologia/cronologia.service';
import { DocumentoVersion } from '../documentos/entities/documento-version.entity';
import { Documento } from '../documentos/entities/documento.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { FaseFormulario } from '../formularios/enums/fase-formulario.enum';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { EstadoJornada } from '../jornadas/enums/estado-jornada.enum';
import { TipoJornada } from '../jornadas/enums/tipo-jornada.enum';
import { ProyectoBeneficiario } from '../proyectos/entities/proyecto-beneficiario.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { EstadoProyecto } from '../proyectos/enums/estado-proyecto.enum';
import {
  normalizarIdentificador,
  sqlCedulaIgual,
} from '../proyectos/utils/excel-beneficiarios';
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  AltaRapidaBeneficiarioDto,
  AsignarLineaBaseDto,
  ConfigurarLineaBaseDto,
  EstadoLineaBase,
  EstadoLineaBaseProyectoDto,
  FilaBeneficiarioLineaBaseDto,
  FiltrosBeneficiariosLineaBaseDto,
  PaginaBeneficiariosLineaBaseDto,
  ResultadoAsignacionLineaBaseDto,
  ResumenLineaBaseDto,
} from './dto/linea-base.dto';

/**
 * Última jornada de línea base (no cancelada) de cada beneficiario del
 * proyecto. `$1` = proyecto. Es la base del estado de línea base.
 */
const CTE_ULTIMA_LINEA_BASE = `
  ultima AS (
    SELECT DISTINCT ON (jb.beneficiario_id)
      jb.beneficiario_id,
      j.id AS jornada_id,
      j.estado_funcional::text AS estado_funcional,
      j.fecha,
      j.tecnico_responsable_nombre AS tecnico,
      (SELECT MAX(e.enviado_en) FROM envios_formulario e WHERE e.jornada_id = j.id) AS enviado_en
    FROM jornadas j
    INNER JOIN jornada_beneficiarios jb ON jb.jornada_id = j.id
    WHERE j.proyecto_id = $1
      AND j.fase = '${FaseFormulario.LINEA_BASE}'
      AND j.estado <> '${EstadoJornada.CANCELADA}'
    ORDER BY jb.beneficiario_id, j.creado_en DESC
  )`;

const SQL_ESTADO = `
  CASE
    WHEN u.jornada_id IS NULL THEN '${EstadoLineaBase.SIN_ASIGNAR}'
    WHEN u.estado_funcional = 'APROBADO' THEN '${EstadoLineaBase.COMPLETA}'
    WHEN u.estado_funcional IN ('RECHAZADO', 'EN_CORRECCION') THEN '${EstadoLineaBase.EN_CORRECCION}'
    WHEN u.estado_funcional IN ('SINCRONIZADO', 'EN_REVISION') THEN '${EstadoLineaBase.ENVIADA}'
    ELSE '${EstadoLineaBase.ASIGNADA}'
  END`;

/** Beneficiarios activos del proyecto con su estado de línea base. `$1` = proyecto. */
const SQL_BENEFICIARIOS_CON_ESTADO = `
  WITH ${CTE_ULTIMA_LINEA_BASE}
  SELECT
    pb.beneficiario_id AS "beneficiarioId",
    ${SQL_ESTADO} AS estado,
    u.jornada_id AS "jornadaId",
    u.fecha::text AS fecha,
    u.tecnico,
    u.enviado_en AS "enviadoEn",
    b.nombres,
    b.apellidos,
    b.numero_documento AS "numeroDocumento"
  FROM proyecto_beneficiarios pb
  INNER JOIN beneficiarios b ON b.id = pb.beneficiario_id
  LEFT JOIN ultima u ON u.beneficiario_id = pb.beneficiario_id
  WHERE pb.proyecto_id = $1
    AND pb.esta_activo_en_proyecto = true
    AND b.eliminado_en IS NULL`;

interface FilaEstado {
  beneficiarioId: string;
  estado: EstadoLineaBase;
  jornadaId: string | null;
  fecha: string | null;
  tecnico: string | null;
  enviadoEn: Date | null;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
}

function hoyEnColombia(): string {
  // Colombia no tiene horario de verano: UTC-5 fijo.
  const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return ahora.toISOString().slice(0, 10);
}

function esLlaveDuplicada(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '23505';
}

/**
 * Pestaña Línea base del proyecto. Las jornadas de línea base reutilizan la
 * entidad Jornada con `fase = LINEA_BASE`: sin meta, plan ni subactividad, y
 * excluidas de toda métrica (ver `jornadas/utils/fase-jornada.ts`).
 *
 * Los métodos reciben un proyecto, pero el cálculo de estado es por SQL sobre
 * `proyecto_id`: para la vista consolidada del sidebar basta con cambiar el
 * filtro a varios proyectos.
 */
@Injectable()
export class LineaBaseService {
  constructor(
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(PlantillaFormulario)
    private readonly plantillaRepository: Repository<PlantillaFormulario>,
    @InjectRepository(Beneficiario)
    private readonly beneficiarioRepository: Repository<Beneficiario>,
    @InjectRepository(ProyectoBeneficiario)
    private readonly proyectoBeneficiarioRepository: Repository<ProyectoBeneficiario>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
    @InjectRepository(RespuestaFormulario)
    private readonly respuestaRepository: Repository<RespuestaFormulario>,
    @InjectRepository(Documento)
    private readonly documentoRepository: Repository<Documento>,
    @InjectRepository(DocumentoVersion)
    private readonly versionRepository: Repository<DocumentoVersion>,
    @InjectRepository(HistorialDatoBeneficiario)
    private readonly historialRepository: Repository<HistorialDatoBeneficiario>,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
    private readonly cronologiaService: CronologiaService,
    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // Configuración y resumen
  // -------------------------------------------------------------------------

  async obtenerEstado(
    proyectoId: string,
    usuario: Usuario,
  ): Promise<EstadoLineaBaseProyectoDto> {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    const [proyecto, resumen] = await Promise.all([
      this.buscarProyecto(proyectoId),
      this.resumen(proyectoId),
    ]);
    const plantilla = proyecto.plantillaLineaBase;
    const cantidadPreguntas = plantilla
      ? await this.dataSource
          .createQueryBuilder()
          .from('campos_formulario', 'c')
          .where('c.plantilla_formulario_id = :id', { id: plantilla.id })
          .getCount()
      : 0;
    return {
      plantilla: plantilla
        ? {
            id: plantilla.id,
            nombre: plantilla.nombre,
            version: plantilla.version,
            estaActivo: plantilla.estaActivo,
            cantidadPreguntas,
          }
        : null,
      resumen,
    };
  }

  async configurar(
    proyectoId: string,
    dto: ConfigurarLineaBaseDto,
    usuario: Usuario,
  ): Promise<EstadoLineaBaseProyectoDto> {
    await this.alcanceTerritorialService.assertPuedeGestionarProyecto(
      usuario,
      proyectoId,
    );
    await this.buscarProyecto(proyectoId);

    if (dto.plantillaFormularioId) {
      const plantilla = await this.plantillaRepository.findOne({
        where: { id: dto.plantillaFormularioId },
      });
      if (!plantilla) {
        throw new NotFoundException('Formulario no encontrado');
      }
      if (plantilla.fase !== FaseFormulario.LINEA_BASE) {
        throw new BadRequestException(
          'Ese formulario es de ejecución. Elige uno de tipo línea base.',
        );
      }
      if (!plantilla.estaActivo) {
        throw new BadRequestException(
          'Publica el formulario antes de usarlo como línea base del proyecto.',
        );
      }
    }

    await this.proyectoRepository.update(proyectoId, {
      plantillaLineaBase: dto.plantillaFormularioId
        ? { id: dto.plantillaFormularioId }
        : null,
    });
    return this.obtenerEstado(proyectoId, usuario);
  }

  async resumen(proyectoId: string): Promise<ResumenLineaBaseDto> {
    const filas = await this.dataSource.query<
      Array<{ estado: EstadoLineaBase; total: string }>
    >(
      `SELECT estado, COUNT(*) AS total FROM (${SQL_BENEFICIARIOS_CON_ESTADO}) t GROUP BY estado`,
      [proyectoId],
    );
    const por = new Map(filas.map((f) => [f.estado, Number(f.total)]));
    const sinAsignar = por.get(EstadoLineaBase.SIN_ASIGNAR) ?? 0;
    const asignada = por.get(EstadoLineaBase.ASIGNADA) ?? 0;
    const enviada = por.get(EstadoLineaBase.ENVIADA) ?? 0;
    const enCorreccion = por.get(EstadoLineaBase.EN_CORRECCION) ?? 0;
    const completa = por.get(EstadoLineaBase.COMPLETA) ?? 0;
    return {
      total: sinAsignar + asignada + enviada + enCorreccion + completa,
      sinAsignar,
      asignada,
      enviada,
      enCorreccion,
      completa,
    };
  }

  // -------------------------------------------------------------------------
  // Listado de beneficiarios
  // -------------------------------------------------------------------------

  async listarBeneficiarios(
    proyectoId: string,
    filtros: FiltrosBeneficiariosLineaBaseDto,
    usuario: Usuario,
  ): Promise<PaginaBeneficiariosLineaBaseDto> {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 25;

    const condiciones: string[] = [];
    const parametros: unknown[] = [proyectoId];
    if (filtros.estado) {
      parametros.push(filtros.estado);
      condiciones.push(`t.estado = $${parametros.length}`);
    }
    if (filtros.busqueda?.trim()) {
      parametros.push(`%${filtros.busqueda.trim()}%`);
      const p = `$${parametros.length}`;
      condiciones.push(
        `(t.nombres || ' ' || t.apellidos ILIKE ${p} OR t."numeroDocumento" ILIKE ${p})`,
      );
    }
    const where = condiciones.length
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';
    parametros.push(limite, (pagina - 1) * limite);

    // Pagina y cuenta en una sola consulta sobre la tabla de vínculos, sin JOINs a colecciones.
    const filas = await this.dataSource.query<
      Array<FilaEstado & { totalFilas: string }>
    >(
      `SELECT t.*, COUNT(*) OVER() AS "totalFilas"
       FROM (${SQL_BENEFICIARIOS_CON_ESTADO}) t
       ${where}
       ORDER BY t.apellidos, t.nombres, t."beneficiarioId"
       LIMIT $${parametros.length - 1} OFFSET $${parametros.length}`,
      parametros,
    );

    const datos = await this.armarFilas(filas);
    return {
      datos,
      total: filas.length ? Number(filas[0].totalFilas) : 0,
      pagina,
      limite,
    };
  }

  /** Detalle territorial y de línea productiva solo para los ids de la página. */
  private async armarFilas(
    filas: FilaEstado[],
  ): Promise<FilaBeneficiarioLineaBaseDto[]> {
    if (!filas.length) return [];
    const beneficiarios = await this.beneficiarioRepository.find({
      where: { id: In(filas.map((f) => f.beneficiarioId)) },
      relations: {
        vereda: { municipio: { departamento: { region: true } } },
        veredaPdet: { municipio: { departamento: { region: true } } },
      },
    });
    const porId = new Map(beneficiarios.map((b) => [b.id, b]));

    return filas.map((fila) => {
      const b = porId.get(fila.beneficiarioId);
      const municipio =
        b?.vereda?.municipio ?? b?.veredaPdet?.municipio ?? null;
      return {
        beneficiarioId: fila.beneficiarioId,
        nombreCompleto: `${fila.nombres ?? ''} ${fila.apellidos ?? ''}`.trim(),
        numeroDocumento: fila.numeroDocumento,
        tipoDocumento: b?.tipoDocumento ?? TipoDocumento.CC,
        lineaProductiva: b?.lineaProductiva ?? null,
        territorio: {
          region: municipio?.departamento?.region?.nombre ?? null,
          departamento: municipio?.departamento?.nombre ?? null,
          municipio: municipio?.nombre ?? b?.municipio ?? null,
          veredaDane: b?.vereda?.nombre ?? null,
          veredaPdet: b?.veredaPdet?.nombre ?? null,
        },
        estado: fila.estado,
        jornadaId: fila.jornadaId,
        fecha: fila.fecha,
        tecnico: fila.tecnico,
        enviadoEn: fila.enviadoEn,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Alta rápida
  // -------------------------------------------------------------------------

  /**
   * Alta con nombre y documento; el resto se completa en campo. Si la cédula
   * ya existe en el catálogo, se vincula esa persona (no se modifican sus datos).
   */
  async altaRapida(
    proyectoId: string,
    dto: AltaRapidaBeneficiarioDto,
    usuario: Usuario,
  ): Promise<FilaBeneficiarioLineaBaseDto> {
    await this.alcanceTerritorialService.assertPuedeGestionarProyecto(
      usuario,
      proyectoId,
    );
    await this.buscarProyecto(proyectoId);

    const identificador = normalizarIdentificador(dto.numeroDocumento);
    if (!identificador) {
      throw new BadRequestException('Indica un número de documento válido.');
    }

    let beneficiario = await this.buscarPorCedula(identificador);
    if (beneficiario?.eliminadoEn) {
      throw new ConflictException(MENSAJE_DOCUMENTO_ELIMINADO);
    }
    if (beneficiario && !beneficiario.estaActivo) {
      throw new ConflictException(
        'Esa persona está inactiva en Contrapartes. Reactívala antes de vincularla al proyecto.',
      );
    }

    if (!beneficiario) {
      try {
        beneficiario = await this.beneficiarioRepository.save(
          this.beneficiarioRepository.create({
            nombres: dto.nombres.trim(),
            apellidos: dto.apellidos.trim(),
            numeroDocumento: identificador,
            tipoDocumento: dto.tipoDocumento ?? TipoDocumento.CC,
            estaActivo: true,
          }),
        );
      } catch (err) {
        if (!esLlaveDuplicada(err)) throw err;
        beneficiario = await this.buscarPorCedula(identificador);
        if (!beneficiario) throw err;
      }
    }

    const vinculo = await this.proyectoBeneficiarioRepository.findOne({
      where: {
        proyecto: { id: proyectoId },
        beneficiario: { id: beneficiario.id },
      },
      relations: { reemplazadoPor: true },
    });
    if (vinculo?.estaActivoEnProyecto) {
      throw new ConflictException('Esa persona ya está en el proyecto.');
    }
    if (vinculo?.reemplazadoPor) {
      throw new ConflictException(
        'Esa persona fue reemplazada en este proyecto y no se puede volver a vincular desde aquí.',
      );
    }
    if (vinculo) {
      vinculo.estaActivoEnProyecto = true;
      await this.proyectoBeneficiarioRepository.save(vinculo);
    } else {
      await this.proyectoBeneficiarioRepository.save(
        this.proyectoBeneficiarioRepository.create({
          proyecto: { id: proyectoId },
          beneficiario: { id: beneficiario.id },
          esPrincipal: false,
          estaActivoEnProyecto: true,
        }),
      );
    }

    const filas = await this.dataSource.query<FilaEstado[]>(
      `SELECT t.* FROM (${SQL_BENEFICIARIOS_CON_ESTADO}) t WHERE t."beneficiarioId" = $2`,
      [proyectoId, beneficiario.id],
    );
    const [fila] = await this.armarFilas(filas);
    return fila;
  }

  private buscarPorCedula(identificador: string): Promise<Beneficiario | null> {
    return this.beneficiarioRepository
      .createQueryBuilder('b')
      .where(sqlCedulaIgual('b'), { id: identificador })
      .getOne();
  }

  // -------------------------------------------------------------------------
  // Asignación de jornadas de línea base
  // -------------------------------------------------------------------------

  /**
   * Una jornada individual de línea base por beneficiario, con el formulario
   * activo del proyecto y el técnico indicado. Sin meta, plan ni subactividad.
   */
  async asignar(
    proyectoId: string,
    dto: AsignarLineaBaseDto,
    usuario: Usuario,
  ): Promise<ResultadoAsignacionLineaBaseDto> {
    await this.alcanceTerritorialService.assertPuedeGestionarProyecto(
      usuario,
      proyectoId,
    );
    const ids = [...new Set(dto.beneficiarioIds)];

    const [proyecto, tecnico, enPersonal, vinculos, ocupados] =
      await Promise.all([
        this.buscarProyecto(proyectoId),
        this.usuarioRepository.findOne({ where: { id: dto.tecnicoId } }),
        this.dataSource.query<unknown[]>(
          'SELECT 1 FROM proyecto_personal WHERE proyecto_id = $1 AND usuario_id = $2',
          [proyectoId, dto.tecnicoId],
        ),
        this.proyectoBeneficiarioRepository.find({
          where: {
            proyecto: { id: proyectoId },
            beneficiario: { id: In(ids) },
            estaActivoEnProyecto: true,
          },
          relations: { beneficiario: { vereda: { municipio: true } } },
        }),
        this.dataSource.query<FilaEstado[]>(
          `SELECT t.* FROM (${SQL_BENEFICIARIOS_CON_ESTADO}) t
         WHERE t."beneficiarioId" = ANY($2::uuid[]) AND t."jornadaId" IS NOT NULL`,
          [proyectoId, ids],
        ),
      ]);

    if (
      proyecto.estado !== EstadoProyecto.ACTIVO &&
      proyecto.estado !== EstadoProyecto.BORRADOR
    ) {
      throw new BadRequestException(
        'Solo se asigna línea base en proyectos en borrador o activos.',
      );
    }
    const plantilla = proyecto.plantillaLineaBase;
    if (!plantilla) {
      throw new BadRequestException(
        'Configura primero el formulario de línea base del proyecto.',
      );
    }
    if (!plantilla.estaActivo || plantilla.fase !== FaseFormulario.LINEA_BASE) {
      throw new BadRequestException(
        'El formulario de línea base del proyecto no está publicado. Publícalo o elige otro.',
      );
    }
    if (!tecnico) throw new NotFoundException('Técnico no encontrado');
    if (!enPersonal.length) {
      throw new BadRequestException(
        'El técnico debe pertenecer al personal del proyecto.',
      );
    }
    if (vinculos.length !== ids.length) {
      throw new BadRequestException(
        'Uno o más beneficiarios no están activos en el proyecto.',
      );
    }
    if (ocupados.length) {
      const nombres = ocupados
        .slice(0, 5)
        .map((f) => `${f.nombres} ${f.apellidos}`.trim())
        .join(', ');
      const resto = ocupados.length > 5 ? ` y ${ocupados.length - 5} más` : '';
      throw new ConflictException(
        `Ya tienen línea base asignada: ${nombres}${resto}. Cancela esa jornada si necesitas asignarla de nuevo.`,
      );
    }

    const fecha = dto.fecha?.slice(0, 10) ?? hoyEnColombia();
    const grupoJornadaId = vinculos.length > 1 ? randomUUID() : null;

    const jornadaIds = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Jornada);
      const creadas: string[] = [];
      for (const vinculo of vinculos) {
        const beneficiario = vinculo.beneficiario;
        const jornada = repo.create({
          fecha: new Date(fecha),
          nombre:
            `Línea base - ${`${beneficiario.nombres} ${beneficiario.apellidos}`.trim()}`.slice(
              0,
              200,
            ),
          observaciones: dto.observaciones,
          tipo: TipoJornada.INDIVIDUAL,
          fase: FaseFormulario.LINEA_BASE,
          requiereRevision: true,
          proyecto: { id: proyectoId },
          meta: null,
          plantillaFormulario: { id: plantilla.id } as PlantillaFormulario,
          vereda: beneficiario.vereda ?? null,
          municipio: beneficiario.vereda?.municipio ?? null,
          geocerca: null,
          tecnicoResponsable: { id: tecnico.id },
          tecnicoResponsableNombre: tecnico.nombreCompleto,
          equipo: [{ id: tecnico.id } as Usuario],
          jornadaActividades: [],
          grupoJornadaId,
          beneficiarios: [{ id: beneficiario.id } as Beneficiario],
          asociaciones: [],
        });
        const guardada = await repo.save(jornada);
        creadas.push(guardada.id);
      }
      return creadas;
    });

    await this.cronologiaService.registrar({
      actorId: usuario.id,
      proyectoId,
      accion: 'JORNADA_CREADA',
      entidadTipo: 'jornada',
      entidadId: jornadaIds[0],
      titulo:
        jornadaIds.length === 1
          ? `Asignó línea base a ${tecnico.nombreCompleto}`
          : `Asignó ${jornadaIds.length} jornadas de línea base a ${tecnico.nombreCompleto}`,
      detalle: {
        origen: 'api',
        fase: FaseFormulario.LINEA_BASE,
        grupoJornadaId,
        cantidad: jornadaIds.length,
      },
    });

    return { creadas: jornadaIds.length, grupoJornadaId, jornadaIds };
  }

  // -------------------------------------------------------------------------
  // Detalle de una jornada de línea base: respuestas, versiones y cambios
  // -------------------------------------------------------------------------

  async detalleJornada(
    proyectoId: string,
    jornadaId: string,
    usuario: Usuario,
  ) {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId, proyecto: { id: proyectoId } },
      relations: { plantillaFormulario: true, tecnicoResponsable: true },
    });
    if (!jornada || jornada.fase !== FaseFormulario.LINEA_BASE) {
      throw new NotFoundException('Jornada de línea base no encontrada');
    }

    const [beneficiario, envio, documentos, cambios] = await Promise.all([
      this.beneficiarioRepository
        .createQueryBuilder('b')
        .innerJoin('jornada_beneficiarios', 'jb', 'jb.beneficiario_id = b.id')
        .where('jb.jornada_id = :jornadaId', { jornadaId })
        .getOne(),
      this.envioRepository.findOne({
        where: { jornada: { id: jornadaId } },
        relations: { usuario: true },
        order: { enviadoEn: 'DESC' },
      }),
      this.documentoRepository.find({ where: { jornadaId } }),
      this.historialRepository.find({
        where: { jornadaId },
        relations: { usuario: true },
        order: { creadoEn: 'ASC' },
      }),
    ]);

    const [campos, respuestas, versiones] = await Promise.all([
      jornada.plantillaFormulario
        ? this.dataSource
            .createQueryBuilder()
            .select([
              'c.id AS id',
              'c.clave AS clave',
              'c.etiqueta AS etiqueta',
              'c.tipo_campo AS "tipoCampo"',
              'c.orden AS orden',
              'c.vincular_beneficiario AS "vincularBeneficiario"',
            ])
            .from('campos_formulario', 'c')
            .where('c.plantilla_formulario_id = :id', {
              id: jornada.plantillaFormulario.id,
            })
            .orderBy('c.orden', 'ASC')
            .getRawMany()
        : Promise.resolve([]),
      envio
        ? this.respuestaRepository.find({
            where: { envioFormulario: { id: envio.id } },
            relations: { campoFormulario: true },
          })
        : Promise.resolve([] as RespuestaFormulario[]),
      documentos.length
        ? this.versionRepository.find({
            where: { documentId: In(documentos.map((d) => d.id)) },
            relations: { createdByUser: true },
            order: { versionNumber: 'DESC' },
          })
        : Promise.resolve([] as DocumentoVersion[]),
    ]);

    return {
      jornada: {
        id: jornada.id,
        fecha: jornada.fecha,
        estado: jornada.estado,
        estadoFuncional: jornada.estadoFuncional,
        tecnico: jornada.tecnicoResponsableNombre,
        latitud: jornada.latitud != null ? Number(jornada.latitud) : null,
        longitud: jornada.longitud != null ? Number(jornada.longitud) : null,
        plantilla: jornada.plantillaFormulario
          ? {
              id: jornada.plantillaFormulario.id,
              nombre: jornada.plantillaFormulario.nombre,
              version: jornada.plantillaFormulario.version,
            }
          : null,
      },
      beneficiario: beneficiario
        ? {
            id: beneficiario.id,
            nombreCompleto:
              `${beneficiario.nombres} ${beneficiario.apellidos}`.trim(),
            numeroDocumento: beneficiario.numeroDocumento,
          }
        : null,
      envio: envio
        ? {
            id: envio.id,
            enviadoEn: envio.enviadoEn,
            usuario: envio.usuario?.nombreCompleto ?? null,
          }
        : null,
      campos,
      respuestas: respuestas.map((r) => ({
        claveCampo: r.claveCampo,
        campoId: r.campoFormulario?.id,
        valorTexto: r.valorTexto,
        valorNumero: r.valorNumero != null ? Number(r.valorNumero) : null,
        valorFecha: r.valorFecha,
        valorBooleano: r.valorBooleano,
        valorJson: r.valorJson,
        urlArchivo: r.urlArchivo,
      })),
      versiones: versiones.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        creadoEn: v.createdAt,
        creadoPor: v.createdByUser?.nombreCompleto ?? null,
        motivo: v.changeReason,
        snapshot: v.snapshot,
      })),
      cambiosAplicados: cambios.map((c) => ({
        campo: c.campo,
        etiqueta: c.etiqueta,
        valorAnterior: c.valorAnterior,
        valorNuevo: c.valorNuevo,
        usuario: c.usuario?.nombreCompleto ?? null,
        creadoEn: c.creadoEn,
      })),
    };
  }

  /** Cambios de datos de un beneficiario aplicados desde línea base (todos los proyectos). */
  async historialBeneficiario(
    proyectoId: string,
    beneficiarioId: string,
    usuario: Usuario,
  ) {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    const filas = await this.historialRepository.find({
      where: { beneficiario: { id: beneficiarioId } },
      relations: { usuario: true, proyecto: true },
      order: { creadoEn: 'DESC' },
      take: 500,
    });
    return filas.map((c) => ({
      id: c.id,
      campo: c.campo,
      etiqueta: c.etiqueta,
      valorAnterior: c.valorAnterior,
      valorNuevo: c.valorNuevo,
      origen: c.origen,
      jornadaId: c.jornadaId,
      proyecto: c.proyecto
        ? { id: c.proyecto.id, nombre: c.proyecto.nombre }
        : null,
      usuario: c.usuario?.nombreCompleto ?? null,
      creadoEn: c.creadoEn,
    }));
  }

  private async buscarProyecto(id: string): Promise<Proyecto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id },
      relations: { plantillaLineaBase: true },
    });
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto;
  }
}
