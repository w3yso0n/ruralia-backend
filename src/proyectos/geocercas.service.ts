import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActualizarGeocercaDto,
  CrearGeocercaDto,
  RespuestaGeocercaDto,
} from './dto/geocerca.dto';
import { Geocerca, PuntoGeocerca } from './entities/geocerca.entity';
import { Proyecto } from './entities/proyecto.entity';
import { aRespuestaGeocerca } from './utils/serializar-geocerca';

const COLOR_POR_DEFECTO = '#42827A';

@Injectable()
export class GeocercasService {
  constructor(
    @InjectRepository(Geocerca)
    private readonly geocercaRepository: Repository<Geocerca>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
  ) {}

  async listar(proyectoId: string): Promise<RespuestaGeocercaDto[]> {
    await this.asegurarProyecto(proyectoId);
    const geocercas = await this.geocercaRepository.find({
      where: { proyectoId },
      order: { creadoEn: 'ASC' },
    });
    return geocercas.map(aRespuestaGeocerca);
  }

  async obtenerUno(
    proyectoId: string,
    geocercaId: string,
  ): Promise<RespuestaGeocercaDto> {
    const geocerca = await this.buscarEnProyecto(proyectoId, geocercaId);
    return aRespuestaGeocerca(geocerca);
  }

  async crear(
    proyectoId: string,
    dto: CrearGeocercaDto,
  ): Promise<RespuestaGeocercaDto> {
    await this.asegurarProyecto(proyectoId);
    const puntos = this.normalizarPuntos(dto.puntos);

    const geocerca = this.geocercaRepository.create({
      proyectoId,
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      color: this.normalizarColor(dto.color),
      puntos,
    });

    const guardada = await this.geocercaRepository.save(geocerca);
    return aRespuestaGeocerca(guardada);
  }

  async actualizar(
    proyectoId: string,
    geocercaId: string,
    dto: ActualizarGeocercaDto,
  ): Promise<RespuestaGeocercaDto> {
    const geocerca = await this.buscarEnProyecto(proyectoId, geocercaId);

    if (dto.nombre !== undefined) {
      geocerca.nombre = dto.nombre.trim();
    }
    if (dto.descripcion !== undefined) {
      geocerca.descripcion = dto.descripcion.trim() || null;
    }
    if (dto.color !== undefined) {
      geocerca.color = this.normalizarColor(dto.color);
    }
    if (dto.puntos !== undefined) {
      geocerca.puntos = this.normalizarPuntos(dto.puntos);
    }

    const guardada = await this.geocercaRepository.save(geocerca);
    return aRespuestaGeocerca(guardada);
  }

  async eliminar(proyectoId: string, geocercaId: string): Promise<void> {
    const geocerca = await this.buscarEnProyecto(proyectoId, geocercaId);
    await this.geocercaRepository.remove(geocerca);
  }

  private async asegurarProyecto(proyectoId: string): Promise<Proyecto> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
    });
    if (!proyecto) {
      throw new NotFoundException(
        `Proyecto con id ${proyectoId} no encontrado`,
      );
    }
    return proyecto;
  }

  private async buscarEnProyecto(
    proyectoId: string,
    geocercaId: string,
  ): Promise<Geocerca> {
    await this.asegurarProyecto(proyectoId);
    const geocerca = await this.geocercaRepository.findOne({
      where: { id: geocercaId, proyectoId },
    });
    if (!geocerca) {
      throw new NotFoundException(
        `Geocerca con id ${geocercaId} no encontrada en este proyecto`,
      );
    }
    return geocerca;
  }

  private normalizarPuntos(
    puntos: Array<{ latitud: number; longitud: number }>,
  ): PuntoGeocerca[] {
    const normalizados = puntos.map((punto) => ({
      latitud: Number(punto.latitud),
      longitud: Number(punto.longitud),
    }));

    if (normalizados.some((p) => Number.isNaN(p.latitud) || Number.isNaN(p.longitud))) {
      throw new BadRequestException('Hay puntos con coordenadas inválidas');
    }

    return normalizados;
  }

  private normalizarColor(color?: string): string {
    if (!color) return COLOR_POR_DEFECTO;
    const valor = color.trim();
    return valor.startsWith('#') ? valor.toUpperCase() : `#${valor.toUpperCase()}`;
  }
}
