import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Indicador } from '../indicadores/entities/indicador.entity';
import { RegistroIndicador } from '../indicadores/entities/registro-indicador.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Vereda } from '../territorios/entities/vereda.entity';
import { NombreRol } from '../usuarios/enums/nombre-rol.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto';
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
import { EstadoProyecto } from './enums/estado-proyecto.enum';
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
      .orderBy('proyecto.creadoEn', 'DESC');

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

    const [proyectos, total] = await query
      .skip(skip)
      .take(limite)
      .getManyAndCount();

    const datos = proyectos.map((proyecto) => aRespuestaProyecto(proyecto));
    return aRespuestaPaginada(datos, total, pagina, limite);
  }

  async obtenerUno(id: string): Promise<RespuestaProyectoDto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id },
      relations: { creador: true, actividades: true, veredas: true },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    const conteoBeneficiarios = await this.contarBeneficiarios(id);
    return aRespuestaProyecto(proyecto, { conteoBeneficiarios });
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
    const resultado = await this.proyectoRepository
      .createQueryBuilder('proyecto')
      .innerJoin('proyecto.beneficiarios', 'beneficiario')
      .where('proyecto.id = :proyectoId', { proyectoId })
      .select('COUNT(DISTINCT beneficiario.id)', 'conteo')
      .getRawOne<{ conteo: string }>();

    return Number(resultado?.conteo ?? 0);
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
