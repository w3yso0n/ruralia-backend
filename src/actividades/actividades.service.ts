import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import {
  usuarioEsCoordinacion,
  usuarioTieneAccesoTotal,
} from '../usuarios/utils/permisos-usuario';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarActividadDto,
  ActualizarSubactividadDto,
  CompletarNodoPlanDto,
  CrearActividadDto,
  CrearSubactividadDto,
} from './dto/actividad.dto';
import {
  RespuestaActividadDto,
  RespuestaPlanProyectoDto,
  RespuestaProgresoProyectoDto,
  RespuestaSubactividadDto,
} from './dto/respuesta-actividad.dto';
import { Actividad } from './entities/actividad.entity';
import { Subactividad } from './entities/subactividad.entity';
import { EstadoAvanceActividad } from './enums/estado-avance-actividad.enum';
import {
  aRespuestaActividad,
  aRespuestaPlan,
  aRespuestaProgreso,
} from './utils/calcular-progreso';

@Injectable()
export class ActividadesService {
  constructor(
    @InjectRepository(Actividad)
    private readonly actividadRepository: Repository<Actividad>,
    @InjectRepository(Subactividad)
    private readonly subactividadRepository: Repository<Subactividad>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
  ) {}

  async crearActividad(
    proyectoId: string,
    dto: CrearActividadDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaActividadDto> {
    const proyecto = await this.buscarProyectoConPersonal(proyectoId);
    this.verificarPermisoGestion(proyecto, usuarioActual);

    const actividad = this.actividadRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      orden: dto.orden ?? 0,
      proyecto: { id: proyectoId },
    });

    const guardada = await this.actividadRepository.save(actividad);
    return this.obtenerActividadRespuesta(guardada.id);
  }

  async actualizarActividad(
    id: string,
    dto: ActualizarActividadDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaActividadDto> {
    const actividad = await this.buscarActividad(id);
    const proyecto = await this.buscarProyectoConPersonal(actividad.proyecto.id);
    this.verificarPermisoGestion(proyecto, usuarioActual);

    if (dto.nombre !== undefined) {
      actividad.nombre = dto.nombre;
    }
    if (dto.descripcion !== undefined) {
      actividad.descripcion = dto.descripcion;
    }
    if (dto.orden !== undefined) {
      actividad.orden = dto.orden;
    }

    await this.actividadRepository.save(actividad);
    return this.obtenerActividadRespuesta(id);
  }

  async eliminarActividad(id: string, usuarioActual: Usuario): Promise<void> {
    const actividad = await this.buscarActividad(id);
    const proyecto = await this.buscarProyectoConPersonal(actividad.proyecto.id);
    this.verificarPermisoGestion(proyecto, usuarioActual);

    actividad.estaActivo = false;
    await this.actividadRepository.save(actividad);
  }

  async completarActividad(
    id: string,
    dto: CompletarNodoPlanDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaActividadDto> {
    const actividad = await this.buscarActividadConSubactividades(id);
    const proyecto = await this.buscarProyectoConPersonal(actividad.proyecto.id);
    this.verificarPermisoGestion(proyecto, usuarioActual);

    const subsActivas =
      actividad.subactividades?.filter((sub) => sub.estaActivo) ?? [];

    if (subsActivas.length > 0) {
      throw new BadRequestException(
        'No se puede completar una actividad que tiene subactividades; complete las subactividades primero',
      );
    }

    actividad.estadoAvance = EstadoAvanceActividad.COMPLETADA;
    actividad.notaCompletado = dto.notaCompletado;
    actividad.completadaEn = new Date();
    actividad.completadaPor = usuarioActual;

    await this.actividadRepository.save(actividad);
    return this.obtenerActividadRespuesta(id);
  }

  async reabrirActividad(
    id: string,
    usuarioActual: Usuario,
  ): Promise<RespuestaActividadDto> {
    const actividad = await this.buscarActividad(id);
    const proyecto = await this.buscarProyectoConPersonal(actividad.proyecto.id);
    this.verificarPermisoGestion(proyecto, usuarioActual);

    actividad.estadoAvance = EstadoAvanceActividad.PENDIENTE;
    actividad.notaCompletado = undefined;
    actividad.completadaEn = undefined;
    actividad.completadaPor = undefined;

    await this.actividadRepository.save(actividad);
    return this.obtenerActividadRespuesta(id);
  }

  async crearSubactividad(
    actividadId: string,
    dto: CrearSubactividadDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaSubactividadDto> {
    const actividad = await this.buscarActividad(actividadId);
    const proyecto = await this.buscarProyectoConPersonal(actividad.proyecto.id);
    this.verificarPermisoGestion(proyecto, usuarioActual);

    if (actividad.estadoAvance === EstadoAvanceActividad.COMPLETADA) {
      actividad.estadoAvance = EstadoAvanceActividad.PENDIENTE;
      actividad.notaCompletado = undefined;
      actividad.completadaEn = undefined;
      actividad.completadaPor = undefined;
      await this.actividadRepository.save(actividad);
    }

    const subactividad = this.subactividadRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      objetivo: dto.objetivo,
      orden: dto.orden ?? 0,
      actividad: { id: actividadId },
    });

    const guardada = await this.subactividadRepository.save(subactividad);
    return this.obtenerSubactividadRespuesta(guardada.id);
  }

  async actualizarSubactividad(
    id: string,
    dto: ActualizarSubactividadDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaSubactividadDto> {
    const subactividad = await this.buscarSubactividad(id);
    const proyecto = await this.buscarProyectoConPersonal(
      subactividad.actividad.proyecto.id,
    );
    this.verificarPermisoGestion(proyecto, usuarioActual);

    if (dto.nombre !== undefined) {
      subactividad.nombre = dto.nombre;
    }
    if (dto.descripcion !== undefined) {
      subactividad.descripcion = dto.descripcion;
    }
    if (dto.objetivo !== undefined) {
      subactividad.objetivo = dto.objetivo;
    }
    if (dto.orden !== undefined) {
      subactividad.orden = dto.orden;
    }

    await this.subactividadRepository.save(subactividad);
    return this.obtenerSubactividadRespuesta(id);
  }

  async eliminarSubactividad(id: string, usuarioActual: Usuario): Promise<void> {
    const subactividad = await this.buscarSubactividad(id);
    const proyecto = await this.buscarProyectoConPersonal(
      subactividad.actividad.proyecto.id,
    );
    this.verificarPermisoGestion(proyecto, usuarioActual);

    subactividad.estaActivo = false;
    await this.subactividadRepository.save(subactividad);
  }

  async completarSubactividad(
    id: string,
    dto: CompletarNodoPlanDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaSubactividadDto> {
    const subactividad = await this.buscarSubactividad(id);
    const proyecto = await this.buscarProyectoConPersonal(
      subactividad.actividad.proyecto.id,
    );
    this.verificarPermisoGestion(proyecto, usuarioActual);

    subactividad.estadoAvance = EstadoAvanceActividad.COMPLETADA;
    subactividad.notaCompletado = dto.notaCompletado;
    subactividad.completadaEn = new Date();
    subactividad.completadaPor = usuarioActual;

    await this.subactividadRepository.save(subactividad);
    return this.obtenerSubactividadRespuesta(id);
  }

  async reabrirSubactividad(
    id: string,
    usuarioActual: Usuario,
  ): Promise<RespuestaSubactividadDto> {
    const subactividad = await this.buscarSubactividad(id);
    const proyecto = await this.buscarProyectoConPersonal(
      subactividad.actividad.proyecto.id,
    );
    this.verificarPermisoGestion(proyecto, usuarioActual);

    subactividad.estadoAvance = EstadoAvanceActividad.PENDIENTE;
    subactividad.notaCompletado = undefined;
    subactividad.completadaEn = undefined;
    subactividad.completadaPor = undefined;

    await this.subactividadRepository.save(subactividad);
    return this.obtenerSubactividadRespuesta(id);
  }

  async obtenerPlan(proyectoId: string): Promise<RespuestaPlanProyectoDto> {
    await this.verificarProyectoExiste(proyectoId);
    const actividades = await this.cargarActividadesProyecto(proyectoId);
    return aRespuestaPlan(proyectoId, actividades);
  }

  async obtenerProgreso(
    proyectoId: string,
  ): Promise<RespuestaProgresoProyectoDto> {
    await this.verificarProyectoExiste(proyectoId);
    const actividades = await this.cargarActividadesProyecto(proyectoId);
    return aRespuestaProgreso(proyectoId, actividades);
  }

  private async obtenerActividadRespuesta(
    id: string,
  ): Promise<RespuestaActividadDto> {
    const actividad = await this.actividadRepository.findOne({
      where: { id },
      relations: {
        subactividades: true,
        completadaPor: true,
      },
    });

    if (!actividad) {
      throw new NotFoundException(`Actividad ${id} no encontrada`);
    }

    return aRespuestaActividad(actividad);
  }

  private async obtenerSubactividadRespuesta(
    id: string,
  ): Promise<RespuestaSubactividadDto> {
    const sub = await this.subactividadRepository.findOne({
      where: { id },
      relations: { completadaPor: true },
    });

    if (!sub) {
      throw new NotFoundException(`Subactividad ${id} no encontrada`);
    }

    return {
      id: sub.id,
      nombre: sub.nombre,
      descripcion: sub.descripcion,
      objetivo: sub.objetivo,
      orden: sub.orden,
      estaActivo: sub.estaActivo,
      estadoAvance: sub.estadoAvance,
      notaCompletado: sub.notaCompletado,
      completadaEn: sub.completadaEn,
      completadaPor: sub.completadaPor
        ? {
            id: sub.completadaPor.id,
            nombreCompleto: sub.completadaPor.nombreCompleto,
          }
        : undefined,
      progresoPorcentaje:
        sub.estadoAvance === EstadoAvanceActividad.COMPLETADA ? 100 : 0,
    };
  }

  private async cargarActividadesProyecto(
    proyectoId: string,
  ): Promise<Actividad[]> {
    return this.actividadRepository.find({
      where: { proyecto: { id: proyectoId } },
      relations: {
        subactividades: true,
        completadaPor: true,
      },
      order: { orden: 'ASC', subactividades: { orden: 'ASC' } },
    });
  }

  private async verificarProyectoExiste(proyectoId: string): Promise<void> {
    const existe = await this.proyectoRepository.existsBy({ id: proyectoId });

    if (!existe) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }
  }

  private async buscarProyectoConPersonal(id: string): Promise<Proyecto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id },
      relations: { personal: true },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${id} no encontrado`);
    }

    return proyecto;
  }

  private async buscarActividad(id: string): Promise<Actividad> {
    const actividad = await this.actividadRepository.findOne({
      where: { id },
      relations: { proyecto: true },
    });

    if (!actividad) {
      throw new NotFoundException(`Actividad ${id} no encontrada`);
    }

    return actividad;
  }

  private async buscarActividadConSubactividades(id: string): Promise<Actividad> {
    const actividad = await this.actividadRepository.findOne({
      where: { id },
      relations: { proyecto: true, subactividades: true },
    });

    if (!actividad) {
      throw new NotFoundException(`Actividad ${id} no encontrada`);
    }

    return actividad;
  }

  private async buscarSubactividad(id: string): Promise<Subactividad> {
    const subactividad = await this.subactividadRepository.findOne({
      where: { id },
      relations: { actividad: { proyecto: true }, completadaPor: true },
    });

    if (!subactividad) {
      throw new NotFoundException(`Subactividad ${id} no encontrada`);
    }

    return subactividad;
  }

  private verificarPermisoGestion(
    proyecto: Proyecto,
    usuarioActual: Usuario,
  ): void {
    if (usuarioTieneAccesoTotal(usuarioActual)) {
      return;
    }

    const esCoordinadorAsignado =
      usuarioEsCoordinacion(usuarioActual) &&
      proyecto.personal?.some((usuario) => usuario.id === usuarioActual.id);

    if (!esCoordinadorAsignado) {
      throw new ForbiddenException(
        'No tiene permisos para gestionar el plan de este proyecto',
      );
    }
  }
}
