import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { Usuario } from '../usuarios/entities/usuario.entity';
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
import {
  EstadisticasProyectoDto,
  RespuestaPaginadaProyectosDto,
  RespuestaProyectoDto,
} from './dto/respuesta-proyecto.dto';
import {
  RespuestaCargaMasivaBeneficiariosDto,
  RespuestaHistorialBeneficiarioProyectoDto,
  ReemplazarBeneficiarioProyectoDto,
} from './dto/carga-beneficiarios.dto';
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
  asignarFilaABeneficiario,
  FilaExcelBeneficiario,
  generarPlantillaExcelBeneficiarios,
  mensajeFilaNoCargada,
  normalizarIdentificador,
  parsearExcelBeneficiarios,
  partirNombreCompleto,
  sqlCedulaIgual,
} from './utils/excel-beneficiarios';
import {
  partirVinculosBeneficiarios,
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

    const query = this.proyectoRepository
      .createQueryBuilder('proyecto')
      .leftJoinAndSelect('proyecto.creador', 'creador')
      .leftJoinAndSelect('proyecto.personal', 'personal')
      .leftJoinAndSelect('proyecto.proyectoBeneficiarios', 'pb')
      .leftJoinAndSelect('pb.beneficiario', 'beneficiario')
      .leftJoinAndSelect('pb.reemplazaA', 'reemplazaA')
      .leftJoinAndSelect('pb.reemplazadoPor', 'reemplazadoPor')
      .leftJoinAndSelect('proyecto.proyectoAsociaciones', 'pa')
      .leftJoinAndSelect('pa.asociacion', 'asociacion')
      .leftJoinAndSelect('proyecto.veredas', 'veredas')
      .leftJoinAndSelect('proyecto.municipios', 'municipiosProyecto')
      .leftJoinAndSelect(
        'municipiosProyecto.departamento',
        'departamentoMunicipio',
      );

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

    const [proyectos, total] = await query
      .skip(skip)
      .take(limite)
      .getManyAndCount();

    const datos = await Promise.all(
      proyectos.map(async (proyecto) => {
        const progreso = await this.actividadesService.obtenerProgreso(
          proyecto.id,
        );
        const { activos, reemplazados } = partirVinculosBeneficiarios(
          proyecto.proyectoBeneficiarios ?? [],
        );
        const principalBenef =
          activos[0] ??
          (proyecto.proyectoBeneficiarios?.find((pb) => pb.esPrincipal)
            ?.beneficiario
            ? resumenDeBeneficiario(
                proyecto.proyectoBeneficiarios.find((pb) => pb.esPrincipal)!
                  .beneficiario,
              )
            : undefined);
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
          conteoBeneficiarios: activos.length,
          progresoPorcentaje: progreso.progresoPorcentaje,
          beneficiarioPrincipal: principalBenef,
          beneficiarios: activos,
          beneficiariosReemplazados: reemplazados,
          asociacionPrincipal: asocMostrar
            ? { id: asocMostrar.id, nombre: asocMostrar.nombre }
            : undefined,
          asociaciones,
          municipios: this.resumirMunicipios(proyecto),
        });
      }),
    );

    const vistaLimitada = !!usuario && usuarioSoloJornadasAsignadas(usuario);
    return aRespuestaPaginada(
      vistaLimitada ? datos.map(aVistaLimitadaProyecto) : datos,
      total,
      pagina,
      limite,
    );
  }

  async obtenerUno(
    id: string,
    usuario?: Usuario,
  ): Promise<RespuestaProyectoDto> {
    if (usuario) {
      await this.alcanceTerritorialService.assertProyectoVisible(usuario, id);
    }
    const proyecto = await this.proyectoRepository.findOne({
      where: { id },
      relations: {
        creador: true,
        actividades: true,
        veredas: true,
        municipios: { departamento: true },
        personal: true,
        proyectoBeneficiarios: {
          beneficiario: true,
          reemplazaA: true,
          reemplazadoPor: true,
        },
        proyectoAsociaciones: { asociacion: true },
      },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    if (usuario && usuarioSoloJornadasAsignadas(usuario)) {
      return aVistaLimitadaProyecto(aRespuestaProyecto(proyecto, {}));
    }

    const progreso = await this.actividadesService.obtenerProgreso(id);
    const { activos, reemplazados } = partirVinculosBeneficiarios(
      proyecto.proyectoBeneficiarios ?? [],
    );
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
      conteoBeneficiarios: activos.length,
      progresoPorcentaje: progreso.progresoPorcentaje,
      beneficiarioPrincipal: activos[0],
      beneficiarios: activos,
      beneficiariosReemplazados: reemplazados,
      asociacionPrincipal: asocMostrar
        ? { id: asocMostrar.id, nombre: asocMostrar.nombre }
        : undefined,
      asociaciones,
      municipios: this.resumirMunicipios(proyecto),
    });
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

    const detalle = await this.proyectoRepository.findOne({
      where: { id },
      relations: {
        veredas: true,
        municipios: true,
        personal: true,
        proyectoBeneficiarios: true,
        proyectoAsociaciones: true,
      },
    });

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
      (detalle.proyectoBeneficiarios?.some((pb) => pb.estaActivoEnProyecto) ??
        false) ||
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

  async importarBeneficiariosExcel(
    proyectoId: string,
    archivo: Express.Multer.File,
    usuarioActual: Usuario,
    veredaIdSolicitada: string,
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

    const filas = await parsearExcelBeneficiarios(archivo.buffer);
    const detalleResultado: RespuestaCargaMasivaBeneficiariosDto['detalle'] =
      [];
    const vistos = new Set<string>();
    let creados = 0;
    let asignadosExistentes = 0;
    let yaEnProyecto = 0;
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
        const { beneficiario, creado, yaEstaba } =
          await this.asegurarBeneficiarioEnProyecto({
            proyectoId,
            fila,
            veredaId,
          });
        if (creado) creados += 1;
        else if (yaEstaba) yaEnProyecto += 1;
        else asignadosExistentes += 1;
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
  }): Promise<{
    beneficiario: Beneficiario;
    creado: boolean;
    yaEstaba: boolean;
  }> {
    const { beneficiario, creado } = await this.buscarOCrearBeneficiario(opts);
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
      return { beneficiario, creado, yaEstaba: true };
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
      return { beneficiario, creado, yaEstaba: true };
    }
    return { beneficiario, creado, yaEstaba: false };
  }

  private async buscarOCrearBeneficiario(opts: {
    fila: FilaExcelBeneficiario;
    veredaId?: string;
  }): Promise<{ beneficiario: Beneficiario; creado: boolean }> {
    const identificador = normalizarIdentificador(opts.fila.identificador);
    const existente = await this.buscarBeneficiarioPorCedula(identificador);
    if (existente) {
      if (existente.eliminadoEn) {
        throw new ConflictException(MENSAJE_DOCUMENTO_ELIMINADO);
      }
      const documento = existente.numeroDocumento;
      asignarFilaABeneficiario(existente, opts.fila, opts.veredaId);
      existente.numeroDocumento = documento;
      if (!existente.estaActivo && opts.fila.estaActivo !== false) {
        existente.estaActivo = true;
      }
      return {
        beneficiario: await this.beneficiarioRepository.save(existente),
        creado: false,
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
      };
    } catch (err) {
      if (!esLlaveDuplicada(err)) throw err;
      const repetido = await this.buscarBeneficiarioPorCedula(identificador);
      if (!repetido || repetido.eliminadoEn) throw err;
      return { beneficiario: repetido, creado: false };
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
    await this.buscarProyecto(proyectoId);

    const conteoBeneficiarios = await this.contarBeneficiarios(proyectoId);

    const conteoJornadas = await this.jornadaRepository.countBy({
      proyecto: { id: proyectoId },
    });

    const conteoFormulariosEnviados = await this.envioFormularioRepository
      .createQueryBuilder('envio')
      .innerJoin('envio.jornada', 'jornada')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .getCount();

    const porcentajeAvanceIndicadores =
      await this.calcularPorcentajeAvanceIndicadores(proyectoId);

    return aEstadisticasProyecto({
      conteoBeneficiarios,
      conteoJornadas,
      conteoFormulariosEnviados,
      porcentajeAvanceIndicadores,
    });
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
    let totalAlcanzado = 0;

    for (const indicador of indicadores) {
      const meta = Number(indicador.valorMeta ?? 0);
      if (meta > 0) {
        totalMeta += meta;
      }

      const resultado = await this.registroIndicadorRepository
        .createQueryBuilder('registro')
        .innerJoin('registro.jornada', 'jornada')
        .where('registro.indicador_id = :indicadorId', {
          indicadorId: indicador.id,
        })
        .andWhere('jornada.proyecto_id = :proyectoId', { proyectoId })
        .select('COALESCE(SUM(registro.valor), 0)', 'suma')
        .getRawOne<{ suma: string }>();

      totalAlcanzado += Number(resultado?.suma ?? 0);
    }

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
