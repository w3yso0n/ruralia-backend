import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { EstadoJornada } from '../jornadas/enums/estado-jornada.enum';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  usuarioEsCoordinacion,
  usuarioTieneAccesoTotal,
} from '../usuarios/utils/permisos-usuario';
import {
  ActualizarMetaDto,
  ActualizarMetaPeriodoDto,
  ActualizarProcesoDto,
  CrearMetaDto,
  CrearMetaPeriodoDto,
  CrearProcesoDto,
} from './dto/proceso.dto';
import {
  RespuestaAvancePeriodoDto,
  RespuestaMetaDto,
  RespuestaMetaPeriodoDto,
  RespuestaProcesoDto,
} from './dto/respuesta-proceso.dto';
import { Meta } from './entities/meta.entity';
import { MetaPeriodo } from './entities/meta-periodo.entity';
import { Proceso } from './entities/proceso.entity';
import { Subactividad } from './entities/subactividad.entity';

@Injectable()
export class ProcesosService {
  constructor(
    @InjectRepository(Proceso)
    private readonly procesoRepository: Repository<Proceso>,
    @InjectRepository(Meta)
    private readonly metaRepository: Repository<Meta>,
    @InjectRepository(MetaPeriodo)
    private readonly metaPeriodoRepository: Repository<MetaPeriodo>,
    @InjectRepository(Subactividad)
    private readonly subactividadRepository: Repository<Subactividad>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
  ) {}

  async crearProceso(
    subactividadId: string,
    dto: CrearProcesoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProcesoDto> {
    const subactividad = await this.buscarSubactividad(subactividadId);
    await this.verificarPermiso(
      subactividad.actividad.proyecto.id,
      usuarioActual,
    );

    const proceso = this.procesoRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      orden: dto.orden ?? 0,
      subactividad: { id: subactividadId },
    });

    const guardado = await this.procesoRepository.save(proceso);
    return this.obtenerProcesoRespuesta(guardado.id);
  }

  async actualizarProceso(
    id: string,
    dto: ActualizarProcesoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaProcesoDto> {
    const proceso = await this.buscarProceso(id);
    await this.verificarPermiso(
      proceso.subactividad.actividad.proyecto.id,
      usuarioActual,
    );

    if (dto.nombre !== undefined) proceso.nombre = dto.nombre;
    if (dto.descripcion !== undefined) proceso.descripcion = dto.descripcion;
    if (dto.orden !== undefined) proceso.orden = dto.orden;

    await this.procesoRepository.save(proceso);
    return this.obtenerProcesoRespuesta(id);
  }

  async eliminarProceso(id: string, usuarioActual: Usuario): Promise<void> {
    const proceso = await this.buscarProceso(id);
    await this.verificarPermiso(
      proceso.subactividad.actividad.proyecto.id,
      usuarioActual,
    );

    proceso.estaActivo = false;
    await this.procesoRepository.save(proceso);
  }

  async listarProcesos(subactividadId: string): Promise<RespuestaProcesoDto[]> {
    const procesos = await this.procesoRepository.find({
      where: { subactividad: { id: subactividadId }, estaActivo: true },
      relations: { metas: { periodos: true } },
      order: { orden: 'ASC', metas: { orden: 'ASC' } },
    });

    return Promise.all(
      procesos.map((p) => this.procesoARespuesta(p)),
    );
  }

  async crearMeta(
    procesoId: string,
    dto: CrearMetaDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaMetaDto> {
    const proceso = await this.buscarProceso(procesoId);
    await this.verificarPermiso(
      proceso.subactividad.actividad.proyecto.id,
      usuarioActual,
    );

    const meta = this.metaRepository.create({
      nombre: dto.nombre,
      unidadMedida: dto.unidadMedida,
      cantidadTotal: dto.cantidadTotal,
      orden: dto.orden ?? 0,
      proceso: { id: procesoId },
    });

    const guardada = await this.metaRepository.save(meta);
    return this.obtenerMetaRespuesta(guardada.id);
  }

  async actualizarMeta(
    id: string,
    dto: ActualizarMetaDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaMetaDto> {
    const meta = await this.buscarMeta(id);
    await this.verificarPermiso(
      meta.proceso.subactividad.actividad.proyecto.id,
      usuarioActual,
    );

    if (dto.nombre !== undefined) meta.nombre = dto.nombre;
    if (dto.unidadMedida !== undefined) meta.unidadMedida = dto.unidadMedida;
    if (dto.cantidadTotal !== undefined) meta.cantidadTotal = dto.cantidadTotal;
    if (dto.orden !== undefined) meta.orden = dto.orden;

    await this.metaRepository.save(meta);
    return this.obtenerMetaRespuesta(id);
  }

  async eliminarMeta(id: string, usuarioActual: Usuario): Promise<void> {
    const meta = await this.buscarMeta(id);
    await this.verificarPermiso(
      meta.proceso.subactividad.actividad.proyecto.id,
      usuarioActual,
    );

    meta.estaActivo = false;
    await this.metaRepository.save(meta);
  }

  async crearMetaPeriodo(
    metaId: string,
    dto: CrearMetaPeriodoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaMetaPeriodoDto> {
    const meta = await this.buscarMeta(metaId);
    await this.verificarPermiso(
      meta.proceso.subactividad.actividad.proyecto.id,
      usuarioActual,
    );

    if (dto.mes < 1 || dto.mes > 12) {
      throw new BadRequestException('El mes debe estar entre 1 y 12');
    }

    const periodo = this.metaPeriodoRepository.create({
      meta: { id: metaId },
      anio: dto.anio,
      mes: dto.mes,
      cantidadPlaneada: dto.cantidadPlaneada,
    });

    const guardado = await this.metaPeriodoRepository.save(periodo);
    return this.periodoARespuesta(guardado, 0);
  }

  async actualizarMetaPeriodo(
    id: string,
    dto: ActualizarMetaPeriodoDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaMetaPeriodoDto> {
    const periodo = await this.buscarMetaPeriodo(id);
    await this.verificarPermiso(
      periodo.meta.proceso.subactividad.actividad.proyecto.id,
      usuarioActual,
    );

    if (dto.cantidadPlaneada !== undefined) {
      periodo.cantidadPlaneada = dto.cantidadPlaneada;
    }

    await this.metaPeriodoRepository.save(periodo);

    const ejecutado = await this.contarJornadasPeriodo(
      periodo.meta.id,
      periodo.anio,
      periodo.mes,
    );

    return this.periodoARespuesta(periodo, ejecutado);
  }

  async eliminarMetaPeriodo(id: string, usuarioActual: Usuario): Promise<void> {
    const periodo = await this.buscarMetaPeriodo(id);
    await this.verificarPermiso(
      periodo.meta.proceso.subactividad.actividad.proyecto.id,
      usuarioActual,
    );

    await this.metaPeriodoRepository.remove(periodo);
  }

  async obtenerAvancePorPeriodo(
    proyectoId: string,
    anio: number,
    mes: number,
  ): Promise<RespuestaAvancePeriodoDto[]> {
    const metas = await this.metaRepository.find({
      where: {
        estaActivo: true,
        proceso: {
          estaActivo: true,
          subactividad: {
            estaActivo: true,
            actividad: { proyecto: { id: proyectoId }, estaActivo: true },
          },
        },
      },
      relations: {
        proceso: {
          subactividad: { actividad: { proyecto: true } },
        },
        periodos: true,
      },
    });

    const resultado: RespuestaAvancePeriodoDto[] = [];

    for (const meta of metas) {
      const periodo = meta.periodos.find(
        (p) => p.anio === anio && p.mes === mes,
      );
      const cantidadPlaneada = Number(periodo?.cantidadPlaneada ?? 0);

      const ejecutadoMes = await this.contarJornadasPeriodo(
        meta.id,
        anio,
        mes,
      );
      const ejecutadoTotal = await this.contarJornadasTotal(meta.id);

      resultado.push({
        metaId: meta.id,
        metaNombre: meta.nombre,
        unidadMedida: meta.unidadMedida,
        anio,
        mes,
        cantidadPlaneada,
        ejecutado: ejecutadoMes,
        progresoPorcentaje:
          cantidadPlaneada > 0
            ? Math.min(100, Math.round((ejecutadoMes / cantidadPlaneada) * 10000) / 100)
            : 0,
        acumuladoTotal: ejecutadoTotal,
        progresoAcumulado:
          Number(meta.cantidadTotal) > 0
            ? Math.min(
                100,
                Math.round(
                  (ejecutadoTotal / Number(meta.cantidadTotal)) * 10000,
                ) / 100,
              )
            : 0,
      });
    }

    return resultado;
  }

  private async contarJornadasPeriodo(
    metaId: string,
    anio: number,
    mes: number,
  ): Promise<number> {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0);

    return this.jornadaRepository
      .createQueryBuilder('jornada')
      .where('jornada.meta_id = :metaId', { metaId })
      .andWhere('jornada.estado = :estado', { estado: EstadoJornada.COMPLETADA })
      .andWhere('jornada.fecha >= :inicio', { inicio })
      .andWhere('jornada.fecha <= :fin', { fin })
      .getCount();
  }

  private async contarJornadasTotal(metaId: string): Promise<number> {
    return this.jornadaRepository.count({
      where: { meta: { id: metaId }, estado: EstadoJornada.COMPLETADA },
    });
  }

  private async obtenerProcesoRespuesta(id: string): Promise<RespuestaProcesoDto> {
    const proceso = await this.procesoRepository.findOne({
      where: { id },
      relations: { metas: { periodos: true } },
    });

    if (!proceso) {
      throw new NotFoundException(`Proceso ${id} no encontrado`);
    }

    return this.procesoARespuesta(proceso);
  }

  private async obtenerMetaRespuesta(id: string): Promise<RespuestaMetaDto> {
    const meta = await this.metaRepository.findOne({
      where: { id },
      relations: { periodos: true },
    });

    if (!meta) {
      throw new NotFoundException(`Meta ${id} no encontrada`);
    }

    const ejecutadoTotal = await this.contarJornadasTotal(id);
    return this.metaARespuesta(meta, ejecutadoTotal);
  }

  private async procesoARespuesta(proceso: Proceso): Promise<RespuestaProcesoDto> {
    const metasConProgreso = await Promise.all(
      (proceso.metas ?? [])
        .filter((m) => m.estaActivo)
        .sort((a, b) => a.orden - b.orden)
        .map(async (meta) => {
          const ejecutadoTotal = await this.contarJornadasTotal(meta.id);
          return this.metaARespuesta(meta, ejecutadoTotal);
        }),
    );

    const progresoProceso =
      metasConProgreso.length > 0
        ? Math.round(
            metasConProgreso.reduce((acc, m) => acc + m.progresoPorcentaje, 0) /
              metasConProgreso.length,
          )
        : 0;

    return {
      id: proceso.id,
      nombre: proceso.nombre,
      descripcion: proceso.descripcion,
      orden: proceso.orden,
      estaActivo: proceso.estaActivo,
      progresoPorcentaje: progresoProceso,
      metas: metasConProgreso,
    };
  }

  private metaARespuesta(meta: Meta, ejecutadoTotal: number): RespuestaMetaDto {
    const cantidadTotal = Number(meta.cantidadTotal);
    const progreso =
      cantidadTotal > 0
        ? Math.min(100, Math.round((ejecutadoTotal / cantidadTotal) * 10000) / 100)
        : 0;

    return {
      id: meta.id,
      nombre: meta.nombre,
      unidadMedida: meta.unidadMedida,
      cantidadTotal,
      orden: meta.orden,
      estaActivo: meta.estaActivo,
      ejecutadoTotal,
      progresoPorcentaje: progreso,
      periodos: (meta.periodos ?? [])
        .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
        .map((p) => this.periodoARespuesta(p, 0)),
    };
  }

  private periodoARespuesta(
    periodo: MetaPeriodo,
    ejecutado: number,
  ): RespuestaMetaPeriodoDto {
    const cantidadPlaneada = Number(periodo.cantidadPlaneada);
    return {
      id: periodo.id,
      anio: periodo.anio,
      mes: periodo.mes,
      cantidadPlaneada,
      ejecutado,
      progresoPorcentaje:
        cantidadPlaneada > 0
          ? Math.min(100, Math.round((ejecutado / cantidadPlaneada) * 10000) / 100)
          : 0,
    };
  }

  private async buscarSubactividad(id: string): Promise<Subactividad> {
    const sub = await this.subactividadRepository.findOne({
      where: { id },
      relations: { actividad: { proyecto: true } },
    });

    if (!sub) throw new NotFoundException(`Subactividad ${id} no encontrada`);
    return sub;
  }

  private async buscarProceso(id: string): Promise<Proceso> {
    const proceso = await this.procesoRepository.findOne({
      where: { id },
      relations: {
        subactividad: { actividad: { proyecto: true } },
        metas: { periodos: true },
      },
    });

    if (!proceso) throw new NotFoundException(`Proceso ${id} no encontrado`);
    return proceso;
  }

  private async buscarMeta(id: string): Promise<Meta> {
    const meta = await this.metaRepository.findOne({
      where: { id },
      relations: {
        proceso: {
          subactividad: { actividad: { proyecto: true } },
        },
        periodos: true,
      },
    });

    if (!meta) throw new NotFoundException(`Meta ${id} no encontrada`);
    return meta;
  }

  private async buscarMetaPeriodo(id: string): Promise<MetaPeriodo> {
    const periodo = await this.metaPeriodoRepository.findOne({
      where: { id },
      relations: {
        meta: {
          proceso: {
            subactividad: { actividad: { proyecto: true } },
          },
        },
      },
    });

    if (!periodo)
      throw new NotFoundException(`MetaPeriodo ${id} no encontrado`);
    return periodo;
  }

  private async verificarPermiso(
    proyectoId: string,
    usuarioActual: Usuario,
  ): Promise<void> {
    if (usuarioTieneAccesoTotal(usuarioActual)) return;

    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
      relations: { personal: true },
    });

    if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);

    const esCoordinadorAsignado =
      usuarioEsCoordinacion(usuarioActual) &&
      proyecto.personal?.some((u) => u.id === usuarioActual.id);

    if (!esCoordinadorAsignado) {
      throw new ForbiddenException(
        'No tiene permisos para gestionar el plan de este proyecto',
      );
    }
  }
}
