import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { isUUID } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { ActividadesService } from '../actividades/actividades.service';
import { Asociacion } from '../asociaciones/entities/asociacion.entity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { MENSAJE_DOCUMENTO_ELIMINADO } from '../beneficiarios/utils/mensajes-beneficiario';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Indicador } from '../indicadores/entities/indicador.entity';
import { RegistroIndicador } from '../indicadores/entities/registro-indicador.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Municipio } from '../territorios/entities/municipio.entity';
import { Vereda } from '../territorios/entities/vereda.entity';
import { usuarioSoloJornadasAsignadas } from '../usuarios/utils/permisos-usuario';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ORDEN_NIVEL_ACCESO } from '../usuarios/enums/nivel-acceso-rol.enum';
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto';
import {
  AsignarAsociacionesProyectoDto,
  AsignarBeneficiariosProyectoDto,
} from './dto/asignar-vinculos.dto';
import { AsignarPersonalDto } from './dto/asignar-personal.dto';
import { AsignarTerritoriosDto } from './dto/asignar-territorios.dto';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { FiltrosProyectoDto } from './dto/filtros-proyecto.dto';
import { FiltrosBeneficiariosProyectoDto } from './dto/filtros-beneficiarios-proyecto.dto';
import {
  EstadisticasProyectoDto,
  RespuestaPaginadaBeneficiariosProyectoDto,
  RespuestaPaginadaProyectosDto,
  RespuestaProyectoDto,
} from './dto/respuesta-proyecto.dto';
import {
  EquipoResumenDto,
  MiembroEquipoResumenDto,
  MunicipioResumenDto,
  ResumenProyectoDto,
  RolEquipoResumenDto,
} from './dto/resumen-proyecto.dto';
import {
  RespuestaCampoBeneficiarioDto,
  RespuestaCargaMasivaBeneficiariosDto,
  RespuestaHistorialBeneficiarioProyectoDto,
  ReemplazarBeneficiarioProyectoDto,
} from './dto/carga-beneficiarios.dto';
import { CampoBeneficiario } from '../beneficiarios/entities/campo-beneficiario.entity';
import {
  camposConocidos,
  etiquetasDeCampos,
  listarCamposBeneficiario,
  registrarCamposBeneficiario,
} from '../beneficiarios/utils/campos-beneficiario';
import {
  calcularCambios,
  revisarFilasExistentes,
  type CambioDatoBeneficiario,
  type FilaExcelRevisada,
} from '../beneficiarios/utils/cambios-beneficiario';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectoAsociacion } from './entities/proyecto-asociacion.entity';
import { ProyectoBeneficiario } from './entities/proyecto-beneficiario.entity';
import { EstadoProyecto } from './enums/estado-proyecto.enum';
import { OrdenProyecto } from './enums/orden-proyecto.enum';
import { TipoProyecto } from './enums/tipo-proyecto.enum';
import {
  aEstadisticasProyecto,
  aRespuestaPaginada,
  aRespuestaProyecto,
  aVistaLimitadaProyecto,
} from './utils/serializar-proyecto';
import {
  analizarExcelBeneficiarios,
  asignarFilaABeneficiario,
  FilaExcelBeneficiario,
  generarPlantillaExcelBeneficiarios,
  leerExcelBeneficiarios,
  leerMapeoFormulario,
  mensajeFilaNoCargada,
  normalizarIdentificador,
  partirNombreCompleto,
  sqlCedulaIgual,
  type AnalisisExcelBeneficiarios,
  type ExcelBeneficiariosLeido,
} from './utils/excel-beneficiarios';
import {
  mapearVinculoBeneficiario,
  resumenDeBeneficiario,
} from './utils/mapear-vinculos-beneficiario';
import { TipoDocumento } from '../beneficiarios/enums/tipo-documento.enum';

function esLlaveDuplicada(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const codigo = (err.driverError as { code?: string } | undefined)?.code;
  return codigo === '23505';
}

@Injectable()
export class ProyectosService {
  constructor(
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(ProyectoBeneficiario)
    private readonly proyectoBeneficiarioRepository: Repository<ProyectoBeneficiario>,
    @InjectRepository(ProyectoAsociacion)
    private readonly proyectoAsociacionRepository: Repository<ProyectoAsociacion>,
    @InjectRepository(Beneficiario)
    private readonly beneficiarioRepository: Repository<Beneficiario>,
    @InjectRepository(Asociacion)
    private readonly asociacionRepository: Repository<Asociacion>,
    @InjectRepository(Vereda)
    private readonly veredaRepository: Repository<Vereda>,
    @InjectRepository(Municipio)
    private readonly municipioRepository: Repository<Municipio>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(EnvioFormulario)
    private readonly envioFormularioRepository: Repository<EnvioFormulario>,
    @InjectRepository(Indicador)
    private readonly indicadorRepository: Repository<Indicador>,
    @InjectRepository(RegistroIndicador)
    private readonly registroIndicadorRepository: Repository<RegistroIndicador>,
    @InjectRepository(CampoBeneficiario)
    private readonly campoBeneficiarioRepository: Repository<CampoBeneficiario>,
    private readonly actividadesService: ActividadesService,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

  async crear(
    dto: CrearProyectoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    await this.verificarNombreUnico(dto.nombre, dto.tipo);

    const proyecto = this.proyectoRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      tipo: dto.tipo,
      fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
      creador: usuarioActual,
      personal: [usuarioActual],
    });

    const guardado = await this.proyectoRepository.save(proyecto);
    return this.obtenerUno(guardado.id);
  }

  async listar(
    filtros: FiltrosProyectoDto,
    usuario?: Usuario,
  ): Promise<RespuestaPaginadaProyectosDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 10;
    const skip = (pagina - 1) * limite;

    // Paginación y conteo solo sobre la tabla de proyectos: los filtros por
    // vínculos usan EXISTS, así que no hacen falta JOINs aquí. Las relaciones
    // se cargan después, únicamente para los proyectos de la página.
    const query = this.proyectoRepository.createQueryBuilder('proyecto');

    if (filtros.estado) {
      query.andWhere('proyecto.estado = :estado', { estado: filtros.estado });
    }

    if (filtros.tipo) {
      query.andWhere('proyecto.tipo = :tipo', { tipo: filtros.tipo });
    }

    if (filtros.busqueda) {
      query.andWhere('proyecto.nombre ILIKE :busqueda', {
        busqueda: `%${filtros.busqueda}%`,
      });
    }

    if (filtros.personalId) {
      query.andWhere(
        'EXISTS (SELECT 1 FROM proyecto_personal pp WHERE pp.proyecto_id = proyecto.id AND pp.usuario_id = :personalId)',
        { personalId: filtros.personalId },
      );
    }

    if (filtros.asociacionId) {
      query.andWhere(
        'EXISTS (SELECT 1 FROM proyecto_asociaciones pas WHERE pas.proyecto_id = proyecto.id AND pas.asociacion_id = :asociacionId)',
        { asociacionId: filtros.asociacionId },
      );
    }

    if (filtros.veredaId) {
      query.andWhere(
        'EXISTS (SELECT 1 FROM proyecto_veredas pv WHERE pv.proyecto_id = proyecto.id AND pv.vereda_id = :veredaId)',
        { veredaId: filtros.veredaId },
      );
    }

    if (usuario) {
      const alcance =
        await this.alcanceTerritorialService.idsProyectosVisibles(usuario);
      if (alcance) {
        if (!alcance.length) {
          return aRespuestaPaginada([], 0, pagina, limite);
        }
        query.andWhere('proyecto.id IN (:...alcanceIds)', {
          alcanceIds: alcance,
        });
      }
    }

    switch (filtros.orden ?? OrdenProyecto.CREADO_DESC) {
      case OrdenProyecto.NOMBRE_ASC:
        query.orderBy('proyecto.nombre', 'ASC');
        break;
      case OrdenProyecto.NOMBRE_DESC:
        query.orderBy('proyecto.nombre', 'DESC');
        break;
      case OrdenProyecto.CREADO_ASC:
        query.orderBy('proyecto.creadoEn', 'ASC');
        break;
      default:
        query.orderBy('proyecto.creadoEn', 'DESC');
    }

    // Página y conteo en paralelo (cada uno en su propia conexión del pool).
    const [filasPagina, total] = await Promise.all([
      query.clone().skip(skip).take(limite).getMany(),
      query.getCount(),
    ]);

    // El técnico solo ve datos generales: no hace falta cargar vínculos ni avance.
    if (usuario && usuarioSoloJornadasAsignadas(usuario)) {
      return aRespuestaPaginada(
        filasPagina.map((p) => aVistaLimitadaProyecto(aRespuestaProyecto(p))),
        total,
        pagina,
        limite,
      );
    }

    const ids = filasPagina.map((p) => p.id);

    const [proyectos, progresoPorProyecto, conteos] = await Promise.all([
      this.cargarProyectosConVinculos(ids),
      this.actividadesService.obtenerProgresoPorProyectos(ids),
      this.contarBeneficiariosActivos(ids),
    ]);

    const datos = proyectos.map((proyecto) => {
      const progresoPorcentaje = progresoPorProyecto.get(proyecto.id) ?? 0;
      const principalAsoc = proyecto.proyectoAsociaciones?.find(
        (pa) => pa.esPrincipal,
      )?.asociacion;
      const asociaciones =
        proyecto.proyectoAsociaciones
          ?.map((pa) => pa.asociacion)
          .filter(Boolean)
          .map((a) => ({
            id: a!.id,
            nombre: a!.nombre,
          })) ?? [];
      const asocMostrar =
        principalAsoc ?? proyecto.proyectoAsociaciones?.[0]?.asociacion;

      return aRespuestaProyecto(proyecto, {
        conteoBeneficiarios: conteos.get(proyecto.id) ?? 0,
        progresoPorcentaje,
        asociacionPrincipal: asocMostrar
          ? { id: asocMostrar.id, nombre: asocMostrar.nombre }
          : undefined,
        asociaciones,
        municipios: this.resumirMunicipios(proyecto),
      });
    });

    return aRespuestaPaginada(datos, total, pagina, limite);
  }

  async obtenerUno(
    id: string,
    usuario?: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const vistaLimitada = !!usuario && usuarioSoloJornadasAsignadas(usuario);

    // Permisos, datos y avance en paralelo: cada consulta usa su propia
    // conexión, así el tiempo total es el de la más lenta y no la suma.
    const [, proyectos, progresoPorProyecto, conteos] = await Promise.all([
      usuario
        ? this.alcanceTerritorialService.assertProyectoVisible(usuario, id)
        : Promise.resolve(),
      vistaLimitada
        ? this.proyectoRepository.find({ where: { id } })
        : this.cargarProyectosConVinculos([id], { actividades: true }),
      vistaLimitada
        ? Promise.resolve(new Map<string, number>())
        : this.actividadesService.obtenerProgresoPorProyectos([id]),
      vistaLimitada
        ? Promise.resolve(new Map<string, number>())
        : this.contarBeneficiariosActivos([id]),
    ]);
    const proyecto = proyectos[0];

    if (!proyecto) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    if (vistaLimitada) {
      return aVistaLimitadaProyecto(aRespuestaProyecto(proyecto, {}));
    }
    const principalAsoc = proyecto.proyectoAsociaciones?.find(
      (pa) => pa.esPrincipal,
    )?.asociacion;
    const asociaciones =
      proyecto.proyectoAsociaciones
        ?.map((pa) => pa.asociacion)
        .filter(Boolean)
        .map((a) => ({
          id: a!.id,
          nombre: a!.nombre,
        })) ?? [];
    const asocMostrar =
      principalAsoc ?? proyecto.proyectoAsociaciones?.[0]?.asociacion;

    return aRespuestaProyecto(proyecto, {
      conteoBeneficiarios: conteos.get(id) ?? 0,
      progresoPorcentaje: progresoPorProyecto.get(id) ?? 0,
      asociacionPrincipal: asocMostrar
        ? { id: asocMostrar.id, nombre: asocMostrar.nombre }
        : undefined,
      asociaciones,
      municipios: this.resumirMunicipios(proyecto),
    });
  }

  /**
   * Carga proyectos con sus vínculos usando una consulta independiente por
   * relación, todas en paralelo. Los beneficiarios no se incluyen: el listado
   * y el detalle solo necesitan el conteo, y la lista se pide paginada.
   * Devuelve los proyectos en el mismo orden que `ids`.
   */
  private async cargarProyectosConVinculos(
    ids: string[],
    opciones: { actividades?: boolean } = {},
  ): Promise<Proyecto[]> {
    if (!ids.length) return [];

    const conColeccion = (relacion: keyof Proyecto) =>
      this.proyectoRepository
        .createQueryBuilder('proyecto')
        .select('proyecto.id')
        .leftJoinAndSelect(`proyecto.${relacion}`, 'rel')
        .where('proyecto.id IN (:...ids)', { ids })
        .getMany();

    const [
      base,
      conPersonal,
      conVeredas,
      conMunicipios,
      conActividades,
      vinculosAsoc,
    ] = await Promise.all([
      this.proyectoRepository.find({
        where: { id: In(ids) },
        relations: { creador: true },
      }),
      conColeccion('personal'),
      conColeccion('veredas'),
      this.proyectoRepository
        .createQueryBuilder('proyecto')
        .select('proyecto.id')
        .leftJoinAndSelect('proyecto.municipios', 'municipio')
        .leftJoinAndSelect('municipio.departamento', 'departamento')
        .where('proyecto.id IN (:...ids)', { ids })
        .getMany(),
      opciones.actividades
        ? conColeccion('actividades')
        : Promise.resolve([] as Proyecto[]),
      this.proyectoAsociacionRepository
        .createQueryBuilder('pa')
        .leftJoin('pa.proyecto', 'proyecto')
        .addSelect('proyecto.id')
        .leftJoinAndSelect('pa.asociacion', 'asociacion')
        .where('pa.proyecto_id IN (:...ids)', { ids })
        .getMany(),
    ]);

    const porId = new Map(base.map((p) => [p.id, p]));
    for (const p of base) {
      p.personal = [];
      p.veredas = [];
      p.municipios = [];
      p.proyectoBeneficiarios = [];
      p.proyectoAsociaciones = [];
      if (opciones.actividades) p.actividades = [];
    }
    for (const p of conPersonal) {
      const destino = porId.get(p.id);
      if (destino) destino.personal = p.personal ?? [];
    }
    for (const p of conVeredas) {
      const destino = porId.get(p.id);
      if (destino) destino.veredas = p.veredas ?? [];
    }
    for (const p of conMunicipios) {
      const destino = porId.get(p.id);
      if (destino) destino.municipios = p.municipios ?? [];
    }
    for (const p of conActividades) {
      const destino = porId.get(p.id);
      if (destino) destino.actividades = p.actividades ?? [];
    }
    for (const pa of vinculosAsoc) {
      porId.get(pa.proyecto?.id)?.proyectoAsociaciones.push(pa);
    }

    return ids.map((id) => porId.get(id)).filter((p): p is Proyecto => !!p);
  }

  /** Conteo de beneficiarios activos. No carga las personas. */
  private async contarBeneficiariosActivos(
    ids: string[],
  ): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const filas = await this.proyectoBeneficiarioRepository
      .createQueryBuilder('pb')
      .select('pb.proyecto_id', 'proyecto_id')
      .addSelect('COUNT(*)', 'total')
      .where('pb.proyecto_id IN (:...ids)', { ids })
      .andWhere('pb.estaActivoEnProyecto = true')
      .groupBy('pb.proyecto_id')
      .getRawMany<Record<string, unknown>>();
    const conteos = new Map<string, number>();
    for (const fila of filas) {
      const proyectoId = String(
        fila.proyecto_id ?? fila.proyectoId ?? fila.pb_proyecto_id ?? '',
      );
      if (!proyectoId) continue;
      conteos.set(proyectoId, Number(fila.total ?? 0));
    }
    return conteos;
  }

  async actualizar(
    id: string,
    dto: ActualizarProyectoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(id);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    const nombre = dto.nombre ?? proyecto.nombre;
    const tipo = dto.tipo ?? proyecto.tipo;

    if (dto.nombre !== undefined || dto.tipo !== undefined) {
      await this.verificarNombreUnico(nombre, tipo, id);
    }

    if (dto.nombre !== undefined) proyecto.nombre = dto.nombre;
    if (dto.descripcion !== undefined) proyecto.descripcion = dto.descripcion;
    if (dto.tipo !== undefined) proyecto.tipo = dto.tipo;
    if (dto.fechaInicio !== undefined) {
      proyecto.fechaInicio = new Date(dto.fechaInicio);
    }
    if (dto.fechaFin !== undefined) {
      proyecto.fechaFin = new Date(dto.fechaFin);
    }

    await this.proyectoRepository.save(proyecto);
    return this.obtenerUno(id);
  }

  async suspender(id: string): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyecto(id);
    proyecto.estado = EstadoProyecto.SUSPENDIDO;
    await this.proyectoRepository.save(proyecto);
    return this.obtenerUno(id);
  }

  async eliminar(id: string, usuarioActual: Usuario): Promise<void> {
    const proyecto = await this.buscarProyectoConPersonal(id);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    const jornadas = await this.jornadaRepository.count({
      where: { proyecto: { id } },
    });

    if (jornadas > 0) {
      throw new BadRequestException(
        'No se puede eliminar un proyecto con jornadas registradas. Elimina las jornadas primero.',
      );
    }

    await this.actividadesService.eliminarPlanPorProyecto(id);
    await this.proyectoBeneficiarioRepository.delete({ proyecto: { id } });
    await this.proyectoAsociacionRepository.delete({ proyecto: { id } });

    const detalle = await this.proyectoRepository.findOne({
      where: { id },
      relations: {
        veredas: true,
        municipios: true,
        personal: true,
        indicadores: true,
      },
    });

    if (!detalle) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    detalle.veredas = [];
    detalle.municipios = [];
    detalle.personal = [];
    detalle.indicadores = [];
    await this.proyectoRepository.save(detalle);
    await this.proyectoRepository.remove(detalle);
  }

  async activar(
    id: string,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(id);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    if (proyecto.estado !== EstadoProyecto.BORRADOR) {
      throw new BadRequestException(
        'Solo se pueden activar proyectos en estado BORRADOR',
      );
    }

    const [detalle, beneficiariosActivos] = await Promise.all([
      this.proyectoRepository.findOne({
        where: { id },
        relations: {
          veredas: true,
          municipios: true,
          personal: true,
          proyectoAsociaciones: true,
        },
      }),
      this.proyectoBeneficiarioRepository.countBy({
        proyecto: { id },
        estaActivoEnProyecto: true,
      }),
    ]);

    if (!detalle) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    if (!detalle.veredas?.length && !detalle.municipios?.length) {
      throw new BadRequestException(
        'Asigna al menos un municipio antes de activar el proyecto',
      );
    }

    if (!detalle.personal?.length) {
      throw new BadRequestException(
        'Asigna personal al proyecto antes de activarlo',
      );
    }

    const tieneContraparte =
      beneficiariosActivos > 0 ||
      (detalle.proyectoAsociaciones?.length ?? 0) > 0;

    if (!tieneContraparte) {
      throw new BadRequestException(
        'Asigna al menos un beneficiario o una asociación antes de activar el proyecto',
      );
    }

    proyecto.estado = EstadoProyecto.ACTIVO;
    await this.proyectoRepository.save(proyecto);
    return this.obtenerUno(id);
  }

  async asignarTerritorios(
    proyectoId: string,
    dto: AsignarTerritoriosDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    if (dto.veredaIds === undefined && dto.municipioIds === undefined) {
      throw new BadRequestException('Indica municipios o veredas');
    }

    if (dto.veredaIds !== undefined) {
      const veredaIds = [...new Set(dto.veredaIds)];
      const veredas = veredaIds.length
        ? await this.veredaRepository.findBy({ id: In(veredaIds) })
        : [];

      if (veredas.length !== veredaIds.length) {
        throw new NotFoundException('Una o más veredas no existen');
      }

      proyecto.veredas = veredas;
    }

    if (dto.municipioIds !== undefined) {
      const municipioIds = [...new Set(dto.municipioIds)];
      const municipios = municipioIds.length
        ? await this.municipioRepository.findBy({ id: In(municipioIds) })
        : [];

      if (municipios.length !== municipioIds.length) {
        throw new NotFoundException('Uno o más municipios no existen');
      }

      proyecto.municipios = municipios;
    }

    await this.proyectoRepository.save(proyecto);
    return this.obtenerUno(proyectoId);
  }

  async asignarPersonal(
    proyectoId: string,
    dto: AsignarPersonalDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    const usuarios = await this.usuarioRepository.findBy({
      id: In(dto.usuarioIds),
    });

    if (usuarios.length !== dto.usuarioIds.length) {
      throw new NotFoundException('Uno o más usuarios no existen');
    }

    proyecto.personal = usuarios;
    await this.proyectoRepository.save(proyecto);
    return this.obtenerUno(proyectoId);
  }

  async asignarBeneficiarios(
    proyectoId: string,
    dto: AsignarBeneficiariosProyectoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    const ids = [
      ...new Set(dto.beneficiarios.map((item) => item.beneficiarioId)),
    ];
    if (ids.length) {
      const beneficiarios = await this.beneficiarioRepository.findBy({
        id: In(ids),
        estaActivo: true,
      });
      if (beneficiarios.length !== ids.length) {
        throw new NotFoundException('Uno o más beneficiarios no existen');
      }
    }

    const existentes = await this.proyectoBeneficiarioRepository.find({
      where: { proyecto: { id: proyectoId } },
      relations: { beneficiario: true },
    });
    const porBeneficiario = new Map(
      existentes.map((v) => [v.beneficiario.id, v]),
    );
    const idsIncoming = new Set(ids);

    for (const id of ids) {
      const actual = porBeneficiario.get(id);
      if (!actual) {
        await this.proyectoBeneficiarioRepository.save(
          this.proyectoBeneficiarioRepository.create({
            proyecto: { id: proyectoId },
            beneficiario: { id },
            esPrincipal: false,
            estaActivoEnProyecto: true,
          }),
        );
        continue;
      }
      if (!actual.estaActivoEnProyecto && !actual.reemplazadoPor) {
        actual.estaActivoEnProyecto = true;
        await this.proyectoBeneficiarioRepository.save(actual);
      }
    }

    for (const vinculo of existentes) {
      if (!vinculo.estaActivoEnProyecto) continue;
      if (idsIncoming.has(vinculo.beneficiario.id)) continue;
      if (vinculo.reemplazadoPor) continue;
      vinculo.estaActivoEnProyecto = false;
      await this.proyectoBeneficiarioRepository.save(vinculo);
    }

    return this.obtenerUno(proyectoId);
  }

  async listarBeneficiariosDelProyecto(
    proyectoId: string,
    filtros: FiltrosBeneficiariosProyectoDto,
    usuario?: Usuario,
  ): Promise<RespuestaPaginadaBeneficiariosProyectoDto> {
    if (usuario) {
      await this.alcanceTerritorialService.assertProyectoVisible(
        usuario,
        proyectoId,
      );
    }
    const pagina = Math.max(filtros.pagina ?? 1, 1);
    const limite = Math.min(Math.max(filtros.limite ?? 20, 1), 50);
    const qb = this.proyectoBeneficiarioRepository
      .createQueryBuilder('pb')
      .innerJoinAndSelect('pb.beneficiario', 'beneficiario')
      .leftJoinAndSelect('pb.reemplazaA', 'reemplazaA')
      .leftJoinAndSelect('pb.reemplazadoPor', 'reemplazadoPor')
      .where('pb.proyecto_id = :proyectoId', { proyectoId });

    if (filtros.estado === 'reemplazados') {
      qb.andWhere('pb.estaActivoEnProyecto = false');
    } else {
      qb.andWhere('pb.estaActivoEnProyecto = true');
    }

    const termino = filtros.busqueda?.trim();
    if (termino) {
      qb.andWhere(
        '(beneficiario.nombres ILIKE :busqueda OR beneficiario.apellidos ILIKE :busqueda OR beneficiario.numeroDocumento ILIKE :busqueda OR beneficiario.datos_adicionales::text ILIKE :busqueda)',
        { busqueda: `%${termino}%` },
      );
    }

    qb.orderBy('beneficiario.apellidos', 'ASC').addOrderBy(
      'beneficiario.nombres',
      'ASC',
    );
    qb.skip((pagina - 1) * limite).take(limite);

    const [filas, total] = await qb.getManyAndCount();
    const datos = filas.flatMap((vinculo) => {
      const resumen = mapearVinculoBeneficiario(vinculo);
      return resumen
        ? [
            {
              ...resumen,
              datosAdicionales: vinculo.beneficiario.datosAdicionales ?? {},
            },
          ]
        : [];
    });

    return plainToInstance(
      RespuestaPaginadaBeneficiariosProyectoDto,
      {
        datos,
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite) || 0,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** Vincula personas sin dar de baja a las que ya están en el proyecto. */
  async vincularBeneficiarios(
    proyectoId: string,
    dto: AsignarBeneficiariosProyectoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    const ids = [
      ...new Set(dto.beneficiarios.map((item) => item.beneficiarioId)),
    ];
    if (!ids.length) {
      throw new BadRequestException('Indica al menos un beneficiario');
    }
    const beneficiarios = await this.beneficiarioRepository.findBy({
      id: In(ids),
      estaActivo: true,
    });
    if (beneficiarios.length !== ids.length) {
      throw new NotFoundException('Uno o más beneficiarios no existen');
    }

    const existentes = await this.proyectoBeneficiarioRepository.find({
      where: { proyecto: { id: proyectoId }, beneficiario: { id: In(ids) } },
      relations: { beneficiario: true },
    });
    const porBeneficiario = new Map(
      existentes.map((v) => [v.beneficiario.id, v]),
    );

    for (const id of ids) {
      const actual = porBeneficiario.get(id);
      if (!actual) {
        await this.proyectoBeneficiarioRepository.save(
          this.proyectoBeneficiarioRepository.create({
            proyecto: { id: proyectoId },
            beneficiario: { id },
            esPrincipal: false,
            estaActivoEnProyecto: true,
          }),
        );
        continue;
      }
      if (actual.estaActivoEnProyecto) {
        if (ids.length === 1) {
          throw new ConflictException(
            'Esa persona ya está vinculada al proyecto',
          );
        }
        continue;
      }
      if (actual.reemplazadoPor) continue;
      actual.estaActivoEnProyecto = true;
      await this.proyectoBeneficiarioRepository.save(actual);
    }

    return this.obtenerUno(proyectoId);
  }

  async desvincularBeneficiario(
    proyectoId: string,
    beneficiarioId: string,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    const vinculo = await this.proyectoBeneficiarioRepository.findOne({
      where: {
        proyecto: { id: proyectoId },
        beneficiario: { id: beneficiarioId },
      },
    });
    if (!vinculo?.estaActivoEnProyecto) {
      throw new NotFoundException(
        'Ese beneficiario no está activo en el proyecto',
      );
    }
    vinculo.estaActivoEnProyecto = false;
    await this.proyectoBeneficiarioRepository.save(vinculo);
    return this.obtenerUno(proyectoId);
  }

  async asignarAsociaciones(
    proyectoId: string,
    dto: AsignarAsociacionesProyectoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    const ids = [...new Set(dto.asociaciones.map((item) => item.asociacionId))];
    if (ids.length) {
      const asociaciones = await this.asociacionRepository.findBy({
        id: In(ids),
        estaActivo: true,
      });
      if (asociaciones.length !== ids.length) {
        throw new NotFoundException('Una o más asociaciones no existen');
      }
    }

    const existentes = await this.proyectoAsociacionRepository.find({
      where: { proyecto: { id: proyectoId } },
      relations: { asociacion: true },
    });
    const porAsociacion = new Map(existentes.map((v) => [v.asociacion.id, v]));
    const idsIncoming = new Set(ids);

    for (const id of ids) {
      if (porAsociacion.has(id)) continue;
      await this.proyectoAsociacionRepository.save(
        this.proyectoAsociacionRepository.create({
          proyecto: { id: proyectoId },
          asociacion: { id },
          esPrincipal: false,
        }),
      );
    }

    for (const vinculo of existentes) {
      if (idsIncoming.has(vinculo.asociacion.id)) continue;
      await this.proyectoAsociacionRepository.remove(vinculo);
    }

    return this.obtenerUno(proyectoId);
  }

  generarPlantillaBeneficiarios(): Promise<Buffer> {
    return generarPlantillaExcelBeneficiarios();
  }

  async listarCamposBeneficiario(
    proyectoId: string,
    usuario: Usuario,
  ): Promise<RespuestaCampoBeneficiarioDto[]> {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    const campos = await listarCamposBeneficiario(
      this.campoBeneficiarioRepository,
      proyectoId,
    );
    return plainToInstance(RespuestaCampoBeneficiarioDto, campos, {
      excludeExtraneousValues: true,
    });
  }

  /** Solo para sugerir claves ya usadas; un id inválido se ignora (el asistente aún no tiene proyecto). */
  private async camposConocidosDe(proyectoId?: string) {
    const id = proyectoId?.trim();
    if (!id || !isUUID(id)) return [];
    return camposConocidos(this.campoBeneficiarioRepository, id);
  }

  async analizarExcelBeneficiarios(
    archivo: Express.Multer.File,
    proyectoId?: string,
  ): Promise<AnalisisExcelBeneficiarios> {
    return analizarExcelBeneficiarios(
      archivo.buffer,
      await this.camposConocidosDe(proyectoId),
    );
  }

  async leerExcelBeneficiarios(
    archivo: Express.Multer.File,
    mapeo?: string,
    proyectoId?: string,
  ): Promise<ExcelBeneficiariosLeido> {
    return leerExcelBeneficiarios(archivo.buffer, {
      mapeo: leerMapeoFormulario(mapeo),
      camposConocidos: await this.camposConocidosDe(proyectoId),
    });
  }

  /** Revisión antes de guardar: marca quién ya está en la plataforma y qué se le va a sobrescribir. */
  async previsualizarExcelBeneficiarios(
    archivo: Express.Multer.File,
    mapeo?: string,
    proyectoId?: string,
  ): Promise<FilaExcelRevisada[]> {
    const { filas, camposExtra } = await this.leerExcelBeneficiarios(
      archivo,
      mapeo,
      proyectoId,
    );
    return revisarFilasExistentes(
      this.beneficiarioRepository,
      filas,
      etiquetasDeCampos(camposExtra),
    );
  }

  async importarBeneficiariosExcel(
    proyectoId: string,
    archivo: Express.Multer.File,
    usuarioActual: Usuario,
    veredaIdSolicitada: string,
    mapeo?: string,
  ): Promise<RespuestaCargaMasivaBeneficiariosDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    const veredaId = veredaIdSolicitada?.trim() || undefined;
    if (veredaId) {
      const vereda = await this.veredaRepository.findOne({
        where: { id: veredaId },
      });
      if (!vereda || !/^[0-9]+$/.test(vereda.codigo)) {
        throw new BadRequestException(
          'La vereda debe ser del catálogo DANE del proyecto',
        );
      }
      const pertenece = await this.proyectoRepository
        .createQueryBuilder('proyecto')
        .innerJoin('proyecto.veredas', 'vereda')
        .where('proyecto.id = :proyectoId', { proyectoId })
        .andWhere('vereda.id = :veredaId', { veredaId })
        .getCount();
      if (!pertenece) {
        throw new BadRequestException(
          'Esa vereda no está vinculada a este proyecto',
        );
      }
    }

    const { filas, camposExtra } = await this.leerExcelBeneficiarios(
      archivo,
      mapeo,
      proyectoId,
    );
    // El dato queda en la persona (una sola por cédula), así que también se describe en el catálogo.
    await Promise.all([
      registrarCamposBeneficiario(
        this.campoBeneficiarioRepository,
        proyectoId,
        camposExtra,
      ),
      registrarCamposBeneficiario(
        this.campoBeneficiarioRepository,
        null,
        camposExtra,
      ),
    ]);
    const etiquetasExtra = etiquetasDeCampos(camposExtra);
    const detalleResultado: RespuestaCargaMasivaBeneficiariosDto['detalle'] =
      [];
    const vistos = new Set<string>();
    let creados = 0;
    let asignadosExistentes = 0;
    let yaEnProyecto = 0;
    let actualizados = 0;
    let errores = 0;

    for (const fila of filas) {
      if (!fila.identificador || !fila.nombres) {
        errores += 1;
        detalleResultado.push({
          fila: fila.fila,
          identificador: fila.identificador,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          resultado: 'error',
          mensaje: mensajeFilaNoCargada(fila, 'incompleta'),
        });
        continue;
      }
      if (vistos.has(fila.identificador)) {
        errores += 1;
        detalleResultado.push({
          fila: fila.fila,
          identificador: fila.identificador,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          resultado: 'error',
          mensaje: mensajeFilaNoCargada(fila, 'duplicada'),
        });
        continue;
      }
      vistos.add(fila.identificador);

      try {
        const { beneficiario, creado, yaEstaba, cambios } =
          await this.asegurarBeneficiarioEnProyecto({
            proyectoId,
            fila,
            veredaId,
            etiquetasExtra,
          });
        if (creado) creados += 1;
        else if (yaEstaba) yaEnProyecto += 1;
        else asignadosExistentes += 1;
        if (cambios.length) actualizados += 1;
        detalleResultado.push({
          fila: fila.fila,
          identificador: fila.identificador,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          resultado: creado
            ? 'creado'
            : yaEstaba
              ? 'ya_en_proyecto'
              : 'asignado_existente',
          beneficiarioId: beneficiario.id,
          mensaje: creado
            ? undefined
            : yaEstaba
              ? 'La cédula ya estaba en el proyecto'
              : 'La cédula ya existía: se vinculó al proyecto sin duplicar',
          cambios: cambios.length ? cambios : undefined,
        });
      } catch (err) {
        errores += 1;
        detalleResultado.push({
          fila: fila.fila,
          identificador: fila.identificador,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          resultado: 'error',
          mensaje: err instanceof Error ? err.message : 'Error al importar',
        });
      }
    }

    return {
      totalFilas: filas.length,
      creados,
      asignadosExistentes,
      yaEnProyecto,
      actualizados,
      errores,
      detalle: detalleResultado,
    };
  }

  async reemplazarBeneficiario(
    proyectoId: string,
    beneficiarioId: string,
    dto: ReemplazarBeneficiarioProyectoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    await this.verificarPermisoGestion(proyecto, usuarioActual);

    const vinculoAnterior = await this.proyectoBeneficiarioRepository.findOne({
      where: {
        proyecto: { id: proyectoId },
        beneficiario: { id: beneficiarioId },
      },
      relations: { beneficiario: true },
    });
    if (!vinculoAnterior || !vinculoAnterior.estaActivoEnProyecto) {
      throw new NotFoundException(
        'El beneficiario no está activo en este proyecto',
      );
    }

    const detalle = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
      relations: { veredas: true },
    });
    const veredaId = detalle?.veredas?.[0]?.id;
    if (!veredaId && !dto.nuevoBeneficiarioId) {
      throw new BadRequestException(
        'El proyecto necesita una vereda para registrar al reemplazo',
      );
    }

    let nuevo: Beneficiario;
    if (dto.nuevoBeneficiarioId) {
      const encontrado = await this.beneficiarioRepository.findOne({
        where: { id: dto.nuevoBeneficiarioId, estaActivo: true },
      });
      if (!encontrado) {
        throw new NotFoundException('El beneficiario de reemplazo no existe');
      }
      nuevo = encontrado;
    } else {
      const nombres = dto.nombres!.trim();
      const partido = partirNombreCompleto(nombres);
      const creado = await this.buscarOCrearBeneficiario({
        fila: {
          fila: 0,
          nombres: partido.nombres,
          apellidos: (dto.apellidos ?? partido.apellidos).trim(),
          identificador: normalizarIdentificador(dto.numeroDocumento!),
          tipoDocumento: dto.tipoDocumento ?? TipoDocumento.CC,
        },
        veredaId: veredaId!,
        etiquetasExtra: new Map(),
      });
      nuevo = creado.beneficiario;
    }

    if (nuevo.id === beneficiarioId) {
      throw new BadRequestException(
        'El reemplazo debe ser una persona distinta',
      );
    }

    const vinculoNuevoExistente =
      await this.proyectoBeneficiarioRepository.findOne({
        where: {
          proyecto: { id: proyectoId },
          beneficiario: { id: nuevo.id },
        },
      });
    if (vinculoNuevoExistente?.estaActivoEnProyecto) {
      throw new ConflictException(
        'Esa persona ya está activa en el proyecto. Elige a otra.',
      );
    }

    const ahora = new Date();
    vinculoAnterior.estaActivoEnProyecto = false;
    vinculoAnterior.reemplazadoPor = nuevo;
    vinculoAnterior.reemplazadoEn = ahora;
    vinculoAnterior.notaReemplazo = dto.nota?.trim() || null;
    await this.proyectoBeneficiarioRepository.save(vinculoAnterior);

    if (vinculoNuevoExistente) {
      vinculoNuevoExistente.estaActivoEnProyecto = true;
      vinculoNuevoExistente.reemplazaA = vinculoAnterior.beneficiario;
      vinculoNuevoExistente.reemplazadoPor = null;
      vinculoNuevoExistente.reemplazadoEn = ahora;
      vinculoNuevoExistente.notaReemplazo = dto.nota?.trim() || null;
      await this.proyectoBeneficiarioRepository.save(vinculoNuevoExistente);
    } else {
      await this.proyectoBeneficiarioRepository.save(
        this.proyectoBeneficiarioRepository.create({
          proyecto: { id: proyectoId },
          beneficiario: nuevo,
          esPrincipal: vinculoAnterior.esPrincipal,
          estaActivoEnProyecto: true,
          reemplazaA: vinculoAnterior.beneficiario,
          reemplazadoEn: ahora,
          notaReemplazo: dto.nota?.trim() || null,
        }),
      );
    }

    return this.obtenerUno(proyectoId);
  }

  async historialBeneficiarioProyecto(
    proyectoId: string,
    beneficiarioId: string,
  ): Promise<RespuestaHistorialBeneficiarioProyectoDto> {
    await this.buscarProyecto(proyectoId);
    const vinculo = await this.proyectoBeneficiarioRepository.findOne({
      where: {
        proyecto: { id: proyectoId },
        beneficiario: { id: beneficiarioId },
      },
      relations: { beneficiario: true, reemplazaA: true, reemplazadoPor: true },
    });
    if (!vinculo) {
      throw new NotFoundException(
        'Ese beneficiario no está vinculado a este proyecto',
      );
    }

    const cadena = await this.cadenaReemplazos(proyectoId, vinculo);
    const idsCadena = cadena.map((b) => b.id);
    if (!idsCadena.length) {
      return {
        beneficiario: resumenDeBeneficiario(vinculo.beneficiario)!,
        reemplazaA: resumenDeBeneficiario(vinculo.reemplazaA ?? undefined),
        reemplazadoPor: resumenDeBeneficiario(
          vinculo.reemplazadoPor ?? undefined,
        ),
        reemplazadoEn: vinculo.reemplazadoEn,
        notaReemplazo: vinculo.notaReemplazo,
        cadenaReemplazos: [],
        jornadas: [],
      };
    }
    const jornadas = await this.jornadaRepository
      .createQueryBuilder('jornada')
      .leftJoinAndSelect('jornada.vereda', 'vereda')
      .innerJoinAndSelect('jornada.beneficiarios', 'beneficiario')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .andWhere('beneficiario.id IN (:...ids)', { ids: idsCadena })
      .orderBy('jornada.fecha', 'ASC')
      .getMany();

    const titularId = vinculo.beneficiario.id;
    return {
      beneficiario: resumenDeBeneficiario(vinculo.beneficiario)!,
      reemplazaA: resumenDeBeneficiario(vinculo.reemplazaA ?? undefined),
      reemplazadoPor: resumenDeBeneficiario(
        vinculo.reemplazadoPor ?? undefined,
      ),
      reemplazadoEn: vinculo.reemplazadoEn,
      notaReemplazo: vinculo.notaReemplazo,
      cadenaReemplazos: cadena.map((b) => resumenDeBeneficiario(b)!),
      jornadas: jornadas.map((jornada) => {
        const enRegistro =
          jornada.beneficiarios?.find((b) => idsCadena.includes(b.id)) ??
          jornada.beneficiarios?.[0];
        return {
          id: jornada.id,
          fecha: jornada.fecha,
          nombre: jornada.nombre,
          estado: jornada.estado,
          vereda: jornada.vereda?.nombre,
          esHeredada: enRegistro ? enRegistro.id !== titularId : false,
          beneficiarioEnRegistro: resumenDeBeneficiario(enRegistro),
        };
      }),
    };
  }

  private async cadenaReemplazos(
    proyectoId: string,
    vinculo: ProyectoBeneficiario,
  ): Promise<Beneficiario[]> {
    const haciaAtras: Beneficiario[] = [];
    let actual: ProyectoBeneficiario | null = vinculo;
    const vistos = new Set<string>();
    while (actual?.reemplazaA && !vistos.has(actual.reemplazaA.id)) {
      vistos.add(actual.reemplazaA.id);
      haciaAtras.unshift(actual.reemplazaA);
      actual = await this.proyectoBeneficiarioRepository.findOne({
        where: {
          proyecto: { id: proyectoId },
          beneficiario: { id: actual.reemplazaA.id },
        },
        relations: { beneficiario: true, reemplazaA: true },
      });
    }
    return [...haciaAtras, vinculo.beneficiario];
  }

  private async asegurarBeneficiarioEnProyecto(opts: {
    proyectoId: string;
    fila: FilaExcelBeneficiario;
    veredaId?: string;
    etiquetasExtra: Map<string, string>;
  }): Promise<{
    beneficiario: Beneficiario;
    creado: boolean;
    yaEstaba: boolean;
    cambios: CambioDatoBeneficiario[];
  }> {
    const { beneficiario, creado, cambios } =
      await this.buscarOCrearBeneficiario(opts);
    const vinculo = await this.proyectoBeneficiarioRepository.findOne({
      where: {
        proyecto: { id: opts.proyectoId },
        beneficiario: { id: beneficiario.id },
      },
    });
    if (vinculo) {
      if (!vinculo.estaActivoEnProyecto && !vinculo.reemplazadoPor) {
        vinculo.estaActivoEnProyecto = true;
        await this.proyectoBeneficiarioRepository.save(vinculo);
      }
      return { beneficiario, creado, yaEstaba: true, cambios };
    }
    try {
      await this.proyectoBeneficiarioRepository.save(
        this.proyectoBeneficiarioRepository.create({
          proyecto: { id: opts.proyectoId },
          beneficiario,
          estaActivoEnProyecto: true,
        }),
      );
    } catch (err) {
      if (!esLlaveDuplicada(err)) throw err;
      return { beneficiario, creado, yaEstaba: true, cambios };
    }
    return { beneficiario, creado, yaEstaba: false, cambios };
  }

  private async buscarOCrearBeneficiario(opts: {
    fila: FilaExcelBeneficiario;
    veredaId?: string;
    etiquetasExtra: Map<string, string>;
  }): Promise<{
    beneficiario: Beneficiario;
    creado: boolean;
    cambios: CambioDatoBeneficiario[];
  }> {
    const identificador = normalizarIdentificador(opts.fila.identificador);
    const existente = await this.buscarBeneficiarioPorCedula(identificador);
    if (existente) {
      if (existente.eliminadoEn) {
        throw new ConflictException(MENSAJE_DOCUMENTO_ELIMINADO);
      }
      const cambios = calcularCambios(existente, opts.fila, opts.etiquetasExtra);
      const documento = existente.numeroDocumento;
      asignarFilaABeneficiario(existente, opts.fila, opts.veredaId);
      existente.numeroDocumento = documento;
      if (!existente.estaActivo && opts.fila.estaActivo !== false) {
        existente.estaActivo = true;
      }
      return {
        beneficiario: await this.beneficiarioRepository.save(existente),
        creado: false,
        cambios,
      };
    }

    const creado = this.beneficiarioRepository.create({
      numeroDocumento: identificador,
      estaActivo: true,
    });
    asignarFilaABeneficiario(creado, opts.fila, opts.veredaId);
    creado.numeroDocumento = identificador;
    try {
      return {
        beneficiario: await this.beneficiarioRepository.save(creado),
        creado: true,
        cambios: [],
      };
    } catch (err) {
      if (!esLlaveDuplicada(err)) throw err;
      const repetido = await this.buscarBeneficiarioPorCedula(identificador);
      if (!repetido || repetido.eliminadoEn) throw err;
      return { beneficiario: repetido, creado: false, cambios: [] };
    }
  }

  private async buscarBeneficiarioPorCedula(
    identificador: string,
  ): Promise<Beneficiario | null> {
    return this.beneficiarioRepository
      .createQueryBuilder('b')
      .where(sqlCedulaIgual('b'), { id: identificador })
      .getOne();
  }

  async obtenerEstadisticas(
    proyectoId: string,
  ): Promise<EstadisticasProyectoDto> {
    const [
      ,
      conteoBeneficiarios,
      conteoJornadas,
      conteoFormulariosEnviados,
      porcentajeAvanceIndicadores,
    ] = await Promise.all([
      this.buscarProyecto(proyectoId),
      this.contarBeneficiarios(proyectoId),
      this.jornadaRepository.countBy({ proyecto: { id: proyectoId } }),
      this.envioFormularioRepository
        .createQueryBuilder('envio')
        .innerJoin('envio.jornada', 'jornada')
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .getCount(),
      this.calcularPorcentajeAvanceIndicadores(proyectoId),
    ]);

    return aEstadisticasProyecto({
      conteoBeneficiarios,
      conteoJornadas,
      conteoFormulariosEnviados,
      porcentajeAvanceIndicadores,
    });
  }

  /**
   * Agregados de la pestaña Resumen. No devuelve listas completas: el equipo
   * va agrupado por rol con una muestra de 4 personas y los beneficiarios
   * se cuentan por municipio con GROUP BY, así la respuesta pesa lo mismo
   * con 10 o con 5.000 personas.
   */
  async obtenerResumen(proyectoId: string): Promise<ResumenProyectoDto> {
    const [
      proyecto,
      progreso,
      jornadas,
      formularios,
      personal,
      filasMunicipio,
      asociaciones,
    ] = await Promise.all([
      this.buscarProyecto(proyectoId),
      this.actividadesService.obtenerProgreso(proyectoId),
      this.jornadaRepository.countBy({ proyecto: { id: proyectoId } }),
      this.envioFormularioRepository
        .createQueryBuilder('envio')
        .innerJoin('envio.jornada', 'jornada')
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .getCount(),
      this.cargarPersonalConRoles(proyectoId),
      this.proyectoBeneficiarioRepository
        .createQueryBuilder('pb')
        .innerJoin('pb.beneficiario', 'b')
        .leftJoin('b.vereda', 'v')
        .leftJoin('v.municipio', 'm')
        .where('pb.proyecto_id = :proyectoId', { proyectoId })
        .andWhere('pb.estaActivoEnProyecto = true')
        .select('m.nombre', 'municipio')
        .addSelect('COUNT(*)', 'total')
        .addSelect('COUNT(v.id)', 'conVereda')
        .groupBy('m.id')
        .addGroupBy('m.nombre')
        .getRawMany<{
          municipio: string | null;
          total: string;
          conVereda: string;
        }>(),
      this.proyectoAsociacionRepository.countBy({
        proyecto: { id: proyectoId },
      }),
    ]);

    let beneficiarios = 0;
    let conVereda = 0;
    let sinMunicipio = 0;
    const porMunicipio: MunicipioResumenDto[] = [];
    for (const fila of filasMunicipio) {
      const total = Number(fila.total);
      beneficiarios += total;
      conVereda += Number(fila.conVereda);
      if (fila.municipio) {
        porMunicipio.push({ municipio: fila.municipio, total });
      } else {
        sinMunicipio += total;
      }
    }
    porMunicipio.sort(
      (a, b) =>
        b.total - a.total ||
        (a.municipio ?? '').localeCompare(b.municipio ?? ''),
    );
    if (sinMunicipio > 0) {
      porMunicipio.push({ municipio: null, total: sinMunicipio });
    }

    return {
      progreso: progreso.progresoPorcentaje,
      jornadas,
      formularios,
      actividades: {
        completadas: progreso.actividadesCompletadas,
        total: progreso.actividadesTotal,
      },
      fechas: {
        inicio: fechaIso(proyecto.fechaInicio),
        fin: fechaIso(proyecto.fechaFin),
      },
      equipo: agruparEquipoPorRol(personal),
      contraparte: {
        beneficiarios,
        asociaciones,
        porMunicipio,
        conVereda,
      },
    };
  }

  /**
   * Personas del equipo para el modal del Resumen. Se pide solo al abrirlo;
   * la agrupación por rol es la misma que la del resumen para que los
   * conteos coincidan. `rolId = 'sin-rol'` filtra al personal sin rol.
   */
  async listarEquipoResumen(
    proyectoId: string,
    filtros: { rolId?: string },
  ): Promise<MiembroEquipoResumenDto[]> {
    const [, personal] = await Promise.all([
      this.buscarProyecto(proyectoId),
      this.cargarPersonalConRoles(proyectoId, { detalle: true }),
    ]);

    return personal
      .map((u) => {
        const principal = rolPrincipal(u);
        return {
          id: u.id,
          nombre: u.nombreCompleto,
          correo: u.correo,
          urlFoto: u.urlFoto ?? null,
          estaActivo: u.estaActivo,
          rolId: principal?.id ?? null,
          rol: principal?.nombre ?? 'Sin rol',
          otrosRoles: (u.roles ?? [])
            .filter((r) => r.id !== principal?.id)
            .map((r) => r.nombre),
        };
      })
      .filter((m) => !filtros.rolId || (m.rolId ?? 'sin-rol') === filtros.rolId)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /** Personal del proyecto con sus roles: una sola colección por consulta. */
  private cargarPersonalConRoles(
    proyectoId: string,
    opciones: { detalle?: boolean } = {},
  ): Promise<Usuario[]> {
    return this.usuarioRepository
      .createQueryBuilder('u')
      .innerJoin(
        'proyecto_personal',
        'pp',
        'pp.usuario_id = u.id AND pp.proyecto_id = :proyectoId',
        { proyectoId },
      )
      .leftJoin('u.roles', 'r')
      .select([
        'u.id',
        'u.nombreCompleto',
        ...(opciones.detalle ? ['u.correo', 'u.urlFoto', 'u.estaActivo'] : []),
        'r.id',
        'r.nombre',
        'r.descripcion',
        'r.nivelAcceso',
      ])
      .getMany();
  }

  private async contarBeneficiarios(proyectoId: string): Promise<number> {
    return this.proyectoBeneficiarioRepository.countBy({
      proyecto: { id: proyectoId },
      estaActivoEnProyecto: true,
    });
  }

  private async calcularPorcentajeAvanceIndicadores(
    proyectoId: string,
  ): Promise<number> {
    const indicadores = await this.indicadorRepository
      .createQueryBuilder('indicador')
      .innerJoin('indicador.proyectos', 'proyecto')
      .where('proyecto.id = :proyectoId', { proyectoId })
      .getMany();

    if (!indicadores.length) {
      return 0;
    }

    let totalMeta = 0;
    for (const indicador of indicadores) {
      const meta = Number(indicador.valorMeta ?? 0);
      if (meta > 0) {
        totalMeta += meta;
      }
    }

    const resultado = await this.registroIndicadorRepository
      .createQueryBuilder('registro')
      .innerJoin('registro.jornada', 'jornada')
      .where('registro.indicador_id IN (:...indicadorIds)', {
        indicadorIds: indicadores.map((i) => i.id),
      })
      .andWhere('jornada.proyecto_id = :proyectoId', { proyectoId })
      .select('COALESCE(SUM(registro.valor), 0)', 'suma')
      .getRawOne<{ suma: string }>();
    const totalAlcanzado = Number(resultado?.suma ?? 0);

    if (totalMeta === 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round((totalAlcanzado / totalMeta) * 100 * 100) / 100,
    );
  }

  private async verificarNombreUnico(
    nombre: string,
    tipo: TipoProyecto,
    excluirId?: string,
  ): Promise<void> {
    const query = this.proyectoRepository
      .createQueryBuilder('proyecto')
      .where('proyecto.nombre = :nombre', { nombre })
      .andWhere('proyecto.tipo = :tipo', { tipo });

    if (excluirId) {
      query.andWhere('proyecto.id != :excluirId', { excluirId });
    }

    const existente = await query.getOne();

    if (existente) {
      throw new ConflictException(
        `Ya existe un proyecto "${nombre}" del tipo ${tipo}`,
      );
    }
  }

  private async verificarPermisoGestion(
    proyecto: Proyecto,
    usuarioActual: Usuario,
  ): Promise<void> {
    await this.alcanceTerritorialService.assertPuedeGestionarProyecto(
      usuarioActual,
      proyecto.id,
    );
  }

  private resumirMunicipios(proyecto: Proyecto) {
    return (proyecto.municipios ?? []).map((municipio) => ({
      id: municipio.id,
      nombre: municipio.nombre,
      codigo: municipio.codigo,
      departamentoNombre: municipio.departamento?.nombre,
    }));
  }

  private async buscarProyecto(id: string): Promise<Proyecto> {
    const proyecto = await this.proyectoRepository.findOne({ where: { id } });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    return proyecto;
  }

  private async buscarProyectoConPersonal(id: string): Promise<Proyecto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id },
      relations: { personal: true, creador: true },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    return proyecto;
  }
}

function fechaIso(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function inicialesDe(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const MAX_MUESTRA_ROL = 4;

function posicionNivel(rol: Rol): number {
  const i = ORDEN_NIVEL_ACCESO.indexOf(rol.nivelAcceso);
  return i === -1 ? ORDEN_NIVEL_ACCESO.length : i;
}

function compararRoles(a: Rol, b: Rol): number {
  return (
    posicionNivel(a) - posicionNivel(b) || a.nombre.localeCompare(b.nombre)
  );
}

/** Rol de mayor alcance de la persona: con él se agrupa en el resumen. */
function rolPrincipal(usuario: Usuario): Rol | null {
  return [...(usuario.roles ?? [])].sort(compararRoles)[0] ?? null;
}

/** Agrupa al personal por su rol de mayor alcance (cada persona cuenta una vez). */
function agruparEquipoPorRol(personal: Usuario[]): EquipoResumenDto {
  const grupos = new Map<string, { rol: Rol | null; miembros: Usuario[] }>();
  for (const usuario of personal) {
    const principal = rolPrincipal(usuario);
    const clave = principal?.id ?? '';
    const grupo = grupos.get(clave) ?? { rol: principal, miembros: [] };
    grupo.miembros.push(usuario);
    grupos.set(clave, grupo);
  }

  const porRol: RolEquipoResumenDto[] = [...grupos.values()]
    .sort((a, b) => {
      if (!a.rol) return 1;
      if (!b.rol) return -1;
      return compararRoles(a.rol, b.rol);
    })
    .map(({ rol, miembros }) => ({
      rolId: rol?.id ?? null,
      rol: rol?.nombre ?? 'Sin rol',
      descripcion: rol
        ? (rol.descripcion ?? null)
        : 'Personas sin rol asignado',
      total: miembros.length,
      muestra: [...miembros]
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
        .slice(0, MAX_MUESTRA_ROL)
        .map((u) => ({
          id: u.id,
          nombre: u.nombreCompleto,
          iniciales: inicialesDe(u.nombreCompleto),
        })),
    }));

  return { total: personal.length, porRol };
}
