import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActividadesService } from '../actividades/actividades.service';
import { Asociacion } from '../asociaciones/entities/asociacion.entity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Indicador } from '../indicadores/entities/indicador.entity';
import { RegistroIndicador } from '../indicadores/entities/registro-indicador.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Vereda } from '../territorios/entities/vereda.entity';
import { NombreRol } from '../usuarios/enums/nombre-rol.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
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
} from './utils/serializar-proyecto';

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
      .leftJoinAndSelect('proyecto.proyectoAsociaciones', 'pa')
      .leftJoinAndSelect('pa.asociacion', 'asociacion')
      .leftJoinAndSelect('proyecto.veredas', 'veredas');

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
        const principalBenef = proyecto.proyectoBeneficiarios?.find(
          (pb) => pb.esPrincipal,
        )?.beneficiario;
        const principalAsoc = proyecto.proyectoAsociaciones?.find(
          (pa) => pa.esPrincipal,
        )?.asociacion;
        const beneficiarios =
          proyecto.proyectoBeneficiarios
            ?.map((pb) => pb.beneficiario)
            .filter(Boolean)
            .map((b) => ({
              id: b!.id,
              nombres: b!.nombres,
              apellidos: b!.apellidos,
            })) ?? [];
        const asociaciones =
          proyecto.proyectoAsociaciones
            ?.map((pa) => pa.asociacion)
            .filter(Boolean)
            .map((a) => ({
              id: a!.id,
              nombre: a!.nombre,
            })) ?? [];
        const benefMostrar =
          principalBenef ?? proyecto.proyectoBeneficiarios?.[0]?.beneficiario;
        const asocMostrar =
          principalAsoc ?? proyecto.proyectoAsociaciones?.[0]?.asociacion;

        return aRespuestaProyecto(proyecto, {
          conteoBeneficiarios: proyecto.proyectoBeneficiarios?.length ?? 0,
          progresoPorcentaje: progreso.progresoPorcentaje,
          beneficiarioPrincipal: benefMostrar
            ? {
                id: benefMostrar.id,
                nombres: benefMostrar.nombres,
                apellidos: benefMostrar.apellidos,
              }
            : undefined,
          beneficiarios,
          asociacionPrincipal: asocMostrar
            ? { id: asocMostrar.id, nombre: asocMostrar.nombre }
            : undefined,
          asociaciones,
        });
      }),
    );

    return aRespuestaPaginada(datos, total, pagina, limite);
  }

  async obtenerUno(id: string): Promise<RespuestaProyectoDto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id },
      relations: {
        creador: true,
        actividades: true,
        veredas: true,
        personal: true,
        proyectoBeneficiarios: { beneficiario: true },
        proyectoAsociaciones: { asociacion: true },
      },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    const progreso = await this.actividadesService.obtenerProgreso(id);
    const principalBenef = proyecto.proyectoBeneficiarios?.find(
      (pb) => pb.esPrincipal,
    )?.beneficiario;
    const principalAsoc = proyecto.proyectoAsociaciones?.find(
      (pa) => pa.esPrincipal,
    )?.asociacion;
    const beneficiarios =
      proyecto.proyectoBeneficiarios
        ?.map((pb) => pb.beneficiario)
        .filter(Boolean)
        .map((b) => ({
          id: b!.id,
          nombres: b!.nombres,
          apellidos: b!.apellidos,
        })) ?? [];
    const asociaciones =
      proyecto.proyectoAsociaciones
        ?.map((pa) => pa.asociacion)
        .filter(Boolean)
        .map((a) => ({
          id: a!.id,
          nombre: a!.nombre,
        })) ?? [];
    const benefMostrar =
      principalBenef ?? proyecto.proyectoBeneficiarios?.[0]?.beneficiario;
    const asocMostrar =
      principalAsoc ?? proyecto.proyectoAsociaciones?.[0]?.asociacion;

    return aRespuestaProyecto(proyecto, {
      conteoBeneficiarios: proyecto.proyectoBeneficiarios?.length ?? 0,
      progresoPorcentaje: progreso.progresoPorcentaje,
      beneficiarioPrincipal: benefMostrar
        ? {
            id: benefMostrar.id,
            nombres: benefMostrar.nombres,
            apellidos: benefMostrar.apellidos,
          }
        : undefined,
      beneficiarios,
      asociacionPrincipal: asocMostrar
        ? { id: asocMostrar.id, nombre: asocMostrar.nombre }
        : undefined,
      asociaciones,
    });
  }

  async actualizar(
    id: string,
    dto: ActualizarProyectoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(id);
    this.verificarPermisoGestion(proyecto, usuarioActual);

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

  async activar(
    id: string,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(id);
    this.verificarPermisoGestion(proyecto, usuarioActual);

    if (proyecto.estado !== EstadoProyecto.BORRADOR) {
      throw new BadRequestException(
        'Solo se pueden activar proyectos en estado BORRADOR',
      );
    }

    const detalle = await this.proyectoRepository.findOne({
      where: { id },
      relations: {
        veredas: true,
        personal: true,
        proyectoBeneficiarios: true,
        proyectoAsociaciones: true,
      },
    });

    if (!detalle) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    if (!detalle.veredas?.length) {
      throw new BadRequestException(
        'Asigna al menos una vereda antes de activar el proyecto',
      );
    }

    if (!detalle.personal?.length) {
      throw new BadRequestException(
        'Asigna personal al proyecto antes de activarlo',
      );
    }

    const tieneContraparte =
      (detalle.proyectoBeneficiarios?.length ?? 0) > 0 ||
      (detalle.proyectoAsociaciones?.length ?? 0) > 0;

    if (!tieneContraparte) {
      throw new BadRequestException(
        'Asigna un beneficiario o una asociación antes de activar el proyecto',
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
    this.verificarPermisoGestion(proyecto, usuarioActual);

    const veredas = await this.veredaRepository.findBy({
      id: In(dto.veredaIds),
    });

    if (veredas.length !== dto.veredaIds.length) {
      throw new NotFoundException('Una o más veredas no existen');
    }

    proyecto.veredas = veredas;
    await this.proyectoRepository.save(proyecto);
    return this.obtenerUno(proyectoId);
  }

  async asignarPersonal(
    proyectoId: string,
    dto: AsignarPersonalDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    this.verificarPermisoGestion(proyecto, usuarioActual);

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
    this.verificarPermisoGestion(proyecto, usuarioActual);

    const ids = dto.beneficiarios.map((item) => item.beneficiarioId);
    const beneficiarios = await this.beneficiarioRepository.findBy({
      id: In(ids),
      estaActivo: true,
    });

    if (beneficiarios.length !== ids.length) {
      throw new NotFoundException('Uno o más beneficiarios no existen');
    }

    const principales = dto.beneficiarios.filter((item) => item.esPrincipal);
    if (principales.length > 1) {
      throw new ConflictException(
        'Solo puede haber un beneficiario principal por proyecto',
      );
    }

    await this.proyectoBeneficiarioRepository.delete({
      proyecto: { id: proyectoId },
    });

    const vinculos = dto.beneficiarios.map((item) =>
      this.proyectoBeneficiarioRepository.create({
        proyecto: { id: proyectoId },
        beneficiario: { id: item.beneficiarioId },
        esPrincipal: item.esPrincipal ?? false,
      }),
    );

    await this.proyectoBeneficiarioRepository.save(vinculos);
    return this.obtenerUno(proyectoId);
  }

  async asignarAsociaciones(
    proyectoId: string,
    dto: AsignarAsociacionesProyectoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProyectoDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    this.verificarPermisoGestion(proyecto, usuarioActual);

    const ids = dto.asociaciones.map((item) => item.asociacionId);
    const asociaciones = await this.asociacionRepository.findBy({
      id: In(ids),
      estaActivo: true,
    });

    if (asociaciones.length !== ids.length) {
      throw new NotFoundException('Una o más asociaciones no existen');
    }

    const principales = dto.asociaciones.filter((item) => item.esPrincipal);
    if (principales.length > 1) {
      throw new ConflictException(
        'Solo puede haber una asociación principal por proyecto',
      );
    }

    await this.proyectoAsociacionRepository.delete({
      proyecto: { id: proyectoId },
    });

    const vinculos = dto.asociaciones.map((item) =>
      this.proyectoAsociacionRepository.create({
        proyecto: { id: proyectoId },
        asociacion: { id: item.asociacionId },
        esPrincipal: item.esPrincipal ?? false,
      }),
    );

    await this.proyectoAsociacionRepository.save(vinculos);
    return this.obtenerUno(proyectoId);
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

  private verificarPermisoGestion(
    proyecto: Proyecto,
    usuarioActual: Usuario,
  ): void {
    const esAdministrador = usuarioActual.roles?.some(
      (rol) => rol.nombre === NombreRol.ADMINISTRADOR,
    );

    if (esAdministrador) {
      return;
    }

    const esCoordinadorAsignado =
      usuarioActual.roles?.some(
        (rol) => rol.nombre === NombreRol.COORDINADOR,
      ) && proyecto.personal?.some((usuario) => usuario.id === usuarioActual.id);

    if (!esCoordinadorAsignado) {
      throw new ForbiddenException(
        'No tiene permisos para gestionar este proyecto',
      );
    }
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
