import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { usuarioTieneAccesoTotal } from '../usuarios/utils/permisos-usuario';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FiltrosCronologiaDto } from './dto/filtros-cronologia.dto';
import {
  RespuestaEventoCronologiaDto,
  RespuestaPaginadaCronologiaDto,
  ResumenCronologiaProyectoDto,
} from './dto/respuesta-cronologia.dto';
import { EventoCronologia } from './entities/evento-cronologia.entity';
import {
  ContextoTituloCronologia,
  formatearTitulo,
} from './formatear-titulo';
import {
  AccionCronologia,
  EntidadCronologia,
  esAccionCronologia,
  OrigenCronologia,
} from './tipos-cronologia';

export interface RegistrarEventoCronologiaInput {
  actorId: string;
  proyectoId: string;
  accion: AccionCronologia;
  entidadTipo: EntidadCronologia;
  entidadId?: string | null;
  contextoTitulo?: ContextoTituloCronologia;
  detalle?: Record<string, unknown> | null;
  ocurridoEn?: Date;
  /** Si se pasa, no se recalcula con formatearTitulo (p. ej. seed). */
  titulo?: string;
}

@Injectable()
export class CronologiaService {
  private readonly logger = new Logger(CronologiaService.name);

  constructor(
    @InjectRepository(EventoCronologia)
    private readonly eventoRepository: Repository<EventoCronologia>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
  ) {}

  /** Emisión best-effort: no lanza; loguea si falla. */
  async registrar(input: RegistrarEventoCronologiaInput): Promise<void> {
    try {
      if (!esAccionCronologia(input.accion)) {
        this.logger.warn(`Acción de cronología no permitida: ${input.accion}`);
        return;
      }

      const titulo =
        input.titulo ??
        formatearTitulo(input.accion, input.contextoTitulo ?? {});

      const evento = this.eventoRepository.create({
        actorId: input.actorId,
        proyectoId: input.proyectoId,
        accion: input.accion,
        entidadTipo: input.entidadTipo,
        entidadId: input.entidadId ?? null,
        titulo,
        detalle: input.detalle ?? null,
        ocurridoEn: input.ocurridoEn ?? new Date(),
      });

      await this.eventoRepository.save(evento);
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar evento de cronología (${input.accion}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async listarPorActor(
    actorId: string,
    consultante: Usuario,
    filtros: FiltrosCronologiaDto,
  ): Promise<RespuestaPaginadaCronologiaDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const query = this.eventoRepository
      .createQueryBuilder('evento')
      .leftJoinAndSelect('evento.actor', 'actor')
      .leftJoinAndSelect('evento.proyecto', 'proyecto')
      .where('evento.actorId = :actorId', { actorId })
      .orderBy('evento.ocurridoEn', 'DESC');

    if (!usuarioTieneAccesoTotal(consultante)) {
      if (actorId !== consultante.id) {
        const proyectosVisibles = await this.idsProyectosPersonal(
          consultante.id,
        );
        if (proyectosVisibles.length === 0) {
          throw new ForbiddenException(
            'No tiene permisos para ver la cronología de este usuario',
          );
        }
        query.andWhere('evento.proyectoId IN (:...proyectosVisibles)', {
          proyectosVisibles,
        });
      }
    }

    this.aplicarFiltrosListado(query, filtros, { omitirActor: true });

    const [eventos, total] = await query
      .skip(skip)
      .take(limite)
      .getManyAndCount();

    return this.aRespuestaPaginada(eventos, total, pagina, limite);
  }

  async listarPorProyecto(
    proyectoId: string,
    consultante: Usuario,
    filtros: FiltrosCronologiaDto,
  ): Promise<RespuestaPaginadaCronologiaDto> {
    await this.asegurarAccesoProyecto(proyectoId, consultante);

    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const query = this.eventoRepository
      .createQueryBuilder('evento')
      .leftJoinAndSelect('evento.actor', 'actor')
      .leftJoinAndSelect('evento.proyecto', 'proyecto')
      .where('evento.proyectoId = :proyectoId', { proyectoId })
      .orderBy('evento.ocurridoEn', 'DESC');

    this.aplicarFiltrosListado(query, filtros);

    const [eventos, total] = await query
      .skip(skip)
      .take(limite)
      .getManyAndCount();

    return this.aRespuestaPaginada(eventos, total, pagina, limite);
  }

  async resumenProyecto(
    proyectoId: string,
    consultante: Usuario,
  ): Promise<ResumenCronologiaProyectoDto> {
    await this.asegurarAccesoProyecto(proyectoId, consultante);

    const totalEventos = await this.eventoRepository.count({
      where: { proyectoId },
    });

    const ultima = await this.eventoRepository.findOne({
      where: { proyectoId },
      order: { ocurridoEn: 'DESC' },
      select: { id: true, ocurridoEn: true },
    });

    const porAccionRaw: Array<{ accion: string; total: string }> =
      await this.eventoRepository
        .createQueryBuilder('evento')
        .select('evento.accion', 'accion')
        .addSelect('COUNT(*)', 'total')
        .where('evento.proyectoId = :proyectoId', { proyectoId })
        .groupBy('evento.accion')
        .orderBy('total', 'DESC')
        .getRawMany();

    const porActorRaw: Array<{
      actorId: string;
      actorNombre: string | null;
      total: string;
    }> = await this.eventoRepository
      .createQueryBuilder('evento')
      .leftJoin('evento.actor', 'actor')
      .select('evento.actorId', 'actorId')
      .addSelect('actor.nombreCompleto', 'actorNombre')
      .addSelect('COUNT(*)', 'total')
      .where('evento.proyectoId = :proyectoId', { proyectoId })
      .groupBy('evento.actorId')
      .addGroupBy('actor.nombreCompleto')
      .orderBy('total', 'DESC')
      .limit(20)
      .getRawMany();

    return {
      proyectoId,
      totalEventos,
      ultimaActividadEn:
        ultima?.ocurridoEn instanceof Date
          ? ultima.ocurridoEn.toISOString()
          : ultima?.ocurridoEn
            ? String(ultima.ocurridoEn)
            : null,
      porAccion: porAccionRaw.map((r) => ({
        accion: r.accion,
        total: Number(r.total),
      })),
      porActor: porActorRaw.map((r) => ({
        actorId: r.actorId,
        actorNombre: r.actorNombre ?? 'Sin nombre',
        total: Number(r.total),
      })),
    };
  }

  /** Expuesto para seed: mismo formateo centralizado. */
  formatearTitulo(
    accion: AccionCronologia,
    contexto?: ContextoTituloCronologia,
  ): string {
    return formatearTitulo(accion, contexto);
  }

  private async asegurarAccesoProyecto(
    proyectoId: string,
    consultante: Usuario,
  ): Promise<void> {
    if (usuarioTieneAccesoTotal(consultante)) {
      return;
    }
    const proyectosVisibles = await this.idsProyectosPersonal(consultante.id);
    if (!proyectosVisibles.includes(proyectoId)) {
      throw new ForbiddenException(
        'No tiene permisos para ver la cronología de este proyecto',
      );
    }
  }

  private aplicarFiltrosListado(
    query: SelectQueryBuilder<EventoCronologia>,
    filtros: FiltrosCronologiaDto,
    opciones?: { omitirActor?: boolean },
  ): void {
    if (!opciones?.omitirActor && filtros.actorId) {
      query.andWhere('evento.actorId = :filtroActorId', {
        filtroActorId: filtros.actorId,
      });
    }
    if (filtros.accion) {
      query.andWhere('evento.accion = :filtroAccion', {
        filtroAccion: filtros.accion,
      });
    }
    if (filtros.fechaDesde) {
      query.andWhere('evento.ocurridoEn >= :fechaDesde', {
        fechaDesde: new Date(filtros.fechaDesde),
      });
    }
    if (filtros.fechaHasta) {
      query.andWhere('evento.ocurridoEn <= :fechaHasta', {
        fechaHasta: new Date(filtros.fechaHasta),
      });
    }
  }

  private async idsProyectosPersonal(usuarioId: string): Promise<string[]> {
    const filas: Array<{ proyecto_id: string }> =
      await this.proyectoRepository.manager.query(
        `SELECT proyecto_id FROM proyecto_personal WHERE usuario_id = $1`,
        [usuarioId],
      );
    return filas.map((f) => f.proyecto_id);
  }

  private aRespuestaPaginada(
    eventos: EventoCronologia[],
    total: number,
    pagina: number,
    limite: number,
  ): RespuestaPaginadaCronologiaDto {
    return {
      datos: eventos.map((e) => this.aRespuesta(e)),
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite) || 0,
    };
  }

  private aRespuesta(evento: EventoCronologia): RespuestaEventoCronologiaDto {
    return {
      id: evento.id,
      actorId: evento.actorId,
      actorNombre: evento.actor?.nombreCompleto,
      proyectoId: evento.proyectoId,
      proyectoNombre: evento.proyecto?.nombre,
      accion: evento.accion,
      entidadTipo: evento.entidadTipo,
      entidadId: evento.entidadId,
      titulo: evento.titulo,
      detalle: evento.detalle,
      ocurridoEn:
        evento.ocurridoEn instanceof Date
          ? evento.ocurridoEn.toISOString()
          : String(evento.ocurridoEn),
    };
  }
}

/** Helper tipado para detalle.origen */
export function detalleConOrigen(
  origen: OrigenCronologia,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return { origen, ...extra };
}
