import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { TipoEvidencia } from '../evidencias/enums/tipo-evidencia.enum';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { EstadoProyecto } from '../proyectos/enums/estado-proyecto.enum';
import { NombreRol } from '../usuarios/enums/nombre-rol.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarJornadaDto,
  AgregarBeneficiariosDto,
  AgregarMiembroEquipoDto,
  CambiarEstadoJornadaDto,
  CrearJornadaDto,
} from './dto/jornada.dto';
import { FiltrosJornadaDto } from './dto/filtros-jornada.dto';
import {
  ResumenJornadaDto,
  RespuestaJornadaDto,
  RespuestaPaginadaJornadasDto,
} from './dto/respuesta-jornada.dto';
import { Jornada } from './entities/jornada.entity';
import { EstadoJornada } from './enums/estado-jornada.enum';
import {
  aResumenJornada,
  aRespuestaJornada,
  aRespuestaPaginadaJornadas,
} from './utils/serializar-jornada';

const TRANSICIONES_VALIDAS: Partial<
  Record<EstadoJornada, EstadoJornada[]>
> = {
  [EstadoJornada.PLANIFICADA]: [EstadoJornada.EN_PROGRESO],
  [EstadoJornada.EN_PROGRESO]: [EstadoJornada.COMPLETADA],
};

@Injectable()
export class JornadasService {
  constructor(
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(Beneficiario)
    private readonly beneficiarioRepository: Repository<Beneficiario>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
  ) {}

  async crear(
    dto: CrearJornadaDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaJornadaDto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: dto.proyectoId },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${dto.proyectoId} no encontrado`);
    }

    if (proyecto.estado !== EstadoProyecto.ACTIVO) {
      throw new BadRequestException(
        'Solo se pueden crear jornadas en proyectos ACTIVOS',
      );
    }

    const jornada = this.jornadaRepository.create({
      fecha: new Date(dto.fecha),
      observaciones: dto.observaciones,
      latitud: dto.latitud,
      longitud: dto.longitud,
      proyecto: { id: dto.proyectoId },
      actividad: { id: dto.actividadId },
      subactividad: dto.subactividadId ? { id: dto.subactividadId } : undefined,
      vereda: { id: dto.veredaId },
      tecnicoResponsable: {
        id: dto.tecnicoResponsableId ?? usuarioActual.id,
      },
      equipo: [{ id: dto.tecnicoResponsableId ?? usuarioActual.id }],
    });

    const guardada = await this.jornadaRepository.save(jornada);
    return this.obtenerUna(guardada.id);
  }

  async listar(
    filtros: FiltrosJornadaDto,
  ): Promise<RespuestaPaginadaJornadasDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 10;
    const skip = (pagina - 1) * limite;

    const query = this.jornadaRepository
      .createQueryBuilder('jornada')
      .leftJoinAndSelect('jornada.proyecto', 'proyecto')
      .leftJoinAndSelect('jornada.actividad', 'actividad')
      .leftJoinAndSelect('jornada.tecnicoResponsable', 'tecnico')
      .orderBy('jornada.fecha', 'DESC');

    if (filtros.proyectoId) {
      query.andWhere('jornada.proyecto_id = :proyectoId', {
        proyectoId: filtros.proyectoId,
      });
    }

    if (filtros.actividadId) {
      query.andWhere('jornada.actividad_id = :actividadId', {
        actividadId: filtros.actividadId,
      });
    }

    if (filtros.estado) {
      query.andWhere('jornada.estado = :estado', { estado: filtros.estado });
    }

    if (filtros.fechaDesde) {
      query.andWhere('jornada.fecha >= :fechaDesde', {
        fechaDesde: filtros.fechaDesde,
      });
    }

    if (filtros.fechaHasta) {
      query.andWhere('jornada.fecha <= :fechaHasta', {
        fechaHasta: filtros.fechaHasta,
      });
    }

    if (filtros.usuarioId) {
      query.andWhere(
        '(jornada.tecnico_responsable_id = :usuarioId OR EXISTS (SELECT 1 FROM jornada_equipo je WHERE je.jornada_id = jornada.id AND je.usuario_id = :usuarioId))',
        { usuarioId: filtros.usuarioId },
      );
    }

    const [jornadas, total] = await query.skip(skip).take(limite).getManyAndCount();
    const datos = jornadas.map((j) => aRespuestaJornada(j));
    return aRespuestaPaginadaJornadas(datos, total, pagina, limite);
  }

  async obtenerUna(id: string): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id },
      relations: {
        proyecto: true,
        actividad: true,
        subactividad: true,
        vereda: true,
        tecnicoResponsable: true,
        beneficiarios: true,
        equipo: true,
      },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    const envios = await this.envioRepository.find({
      where: { jornada: { id } },
      relations: { plantillaFormulario: true },
    });

    const evidencias = await this.evidenciaRepository.find({
      where: { jornada: { id } },
    });

    return aRespuestaJornada(jornada, {
      enviosFormulario: envios,
      evidencias,
    });
  }

  async actualizar(
    id: string,
    dto: ActualizarJornadaDto,
  ): Promise<RespuestaJornadaDto> {
    const jornada = await this.buscarJornada(id);

    if (dto.fecha !== undefined) jornada.fecha = new Date(dto.fecha);
    if (dto.observaciones !== undefined) jornada.observaciones = dto.observaciones;
    if (dto.latitud !== undefined) jornada.latitud = dto.latitud;
    if (dto.longitud !== undefined) jornada.longitud = dto.longitud;
    if (dto.subactividadId !== undefined) {
      jornada.subactividad = { id: dto.subactividadId } as Jornada['subactividad'];
    }
    if (dto.veredaId !== undefined) {
      jornada.vereda = { id: dto.veredaId } as Jornada['vereda'];
    }

    await this.jornadaRepository.save(jornada);
    return this.obtenerUna(id);
  }

  async cambiarEstado(
    id: string,
    dto: CambiarEstadoJornadaDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id },
      relations: { equipo: true, tecnicoResponsable: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    this.verificarPermisoEstado(jornada, usuarioActual);

    const transiciones = TRANSICIONES_VALIDAS[jornada.estado] ?? [];

    if (!transiciones.includes(dto.estado)) {
      throw new BadRequestException(
        `No se puede cambiar de ${jornada.estado} a ${dto.estado}`,
      );
    }

    jornada.estado = dto.estado;
    await this.jornadaRepository.save(jornada);
    return this.obtenerUna(id);
  }

  async agregarBeneficiarios(
    jornadaId: string,
    dto: AgregarBeneficiariosDto,
  ): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId },
      relations: { beneficiarios: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }

    const beneficiarios = await this.beneficiarioRepository.findBy({
      id: In(dto.beneficiarioIds),
    });

    if (beneficiarios.length !== dto.beneficiarioIds.length) {
      throw new NotFoundException('Uno o más beneficiarios no existen');
    }

    const existentes = new Set(jornada.beneficiarios?.map((b) => b.id) ?? []);
    const nuevos = beneficiarios.filter((b) => !existentes.has(b.id));
    jornada.beneficiarios = [...(jornada.beneficiarios ?? []), ...nuevos];

    await this.jornadaRepository.save(jornada);
    return this.obtenerUna(jornadaId);
  }

  async agregarMiembroEquipo(
    jornadaId: string,
    dto: AgregarMiembroEquipoDto,
  ): Promise<RespuestaJornadaDto> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId },
      relations: { equipo: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }

    const usuario = await this.usuarioRepository.findOne({
      where: { id: dto.usuarioId },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);
    }

    const yaEnEquipo = jornada.equipo?.some((u) => u.id === dto.usuarioId);

    if (!yaEnEquipo) {
      jornada.equipo = [...(jornada.equipo ?? []), usuario];
      await this.jornadaRepository.save(jornada);
    }

    return this.obtenerUna(jornadaId);
  }

  async obtenerResumen(jornadaId: string): Promise<ResumenJornadaDto> {
    await this.buscarJornada(jornadaId);

    const conteoFormularios = await this.envioRepository.countBy({
      jornada: { id: jornadaId },
    });

    const conteoEvidencias = await this.evidenciaRepository.countBy({
      jornada: { id: jornadaId },
    });

    const conteoFirmas = await this.evidenciaRepository.countBy({
      jornada: { id: jornadaId },
      tipo: TipoEvidencia.FIRMA,
    });

    const resultado = await this.jornadaRepository
      .createQueryBuilder('jornada')
      .innerJoin('jornada.beneficiarios', 'beneficiario')
      .where('jornada.id = :jornadaId', { jornadaId })
      .select('COUNT(DISTINCT beneficiario.id)', 'conteo')
      .getRawOne<{ conteo: string }>();

    return aResumenJornada({
      conteoFormularios,
      conteoEvidencias,
      conteoFirmas,
      beneficiariosAtendidos: Number(resultado?.conteo ?? 0),
    });
  }

  private verificarPermisoEstado(
    jornada: Jornada,
    usuarioActual: Usuario,
  ): void {
    const esAdmin = usuarioActual.roles?.some(
      (r) => r.nombre === NombreRol.ADMINISTRADOR,
    );
    const esCoord = usuarioActual.roles?.some(
      (r) => r.nombre === NombreRol.COORDINADOR,
    );

    if (esAdmin || esCoord) {
      return;
    }

    const esTecnicoAsignado =
      jornada.tecnicoResponsable?.id === usuarioActual.id ||
      jornada.equipo?.some((u) => u.id === usuarioActual.id);

    if (!esTecnicoAsignado) {
      throw new ForbiddenException(
        'Solo el técnico asignado o un coordinador/administrador puede cambiar el estado',
      );
    }
  }

  private async buscarJornada(id: string): Promise<Jornada> {
    const jornada = await this.jornadaRepository.findOne({ where: { id } });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${id} no encontrada`);
    }

    return jornada;
  }
}
