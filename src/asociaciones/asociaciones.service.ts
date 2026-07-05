import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vereda } from '../territorios/entities/vereda.entity';
import {
  ActualizarAsociacionDto,
  CrearAsociacionDto,
  FiltrosAsociacionDto,
} from './dto/asociacion.dto';
import {
  RespuestaAsociacionDto,
  RespuestaPaginadaAsociacionesDto,
} from './dto/respuesta-asociacion.dto';
import { Asociacion } from './entities/asociacion.entity';
import {
  aRespuestaAsociacion,
  aRespuestaPaginadaAsociaciones,
} from './utils/serializar-asociacion';

@Injectable()
export class AsociacionesService {
  constructor(
    @InjectRepository(Asociacion)
    private readonly asociacionRepository: Repository<Asociacion>,
    @InjectRepository(Vereda)
    private readonly veredaRepository: Repository<Vereda>,
  ) {}

  async listar(
    filtros: FiltrosAsociacionDto,
  ): Promise<RespuestaPaginadaAsociacionesDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const query = this.asociacionRepository
      .createQueryBuilder('asociacion')
      .leftJoinAndSelect('asociacion.vereda', 'vereda')
      .where('asociacion.estaActivo = true')
      .orderBy('asociacion.nombre', 'ASC');

    if (filtros.veredaId) {
      query.andWhere('vereda.id = :veredaId', { veredaId: filtros.veredaId });
    }

    if (filtros.busqueda) {
      query.andWhere(
        '(asociacion.nombre ILIKE :busqueda OR asociacion.nit ILIKE :busqueda)',
        { busqueda: `%${filtros.busqueda}%` },
      );
    }

    const [asociaciones, total] = await query
      .skip(skip)
      .take(limite)
      .getManyAndCount();

    const datos = asociaciones.map(aRespuestaAsociacion);
    return aRespuestaPaginadaAsociaciones(datos, total, pagina, limite);
  }

  async obtenerUno(id: string): Promise<RespuestaAsociacionDto> {
    const asociacion = await this.asociacionRepository.findOne({
      where: { id },
      relations: { vereda: true },
    });

    if (!asociacion) {
      throw new NotFoundException(`Asociación ${id} no encontrada`);
    }

    return aRespuestaAsociacion(asociacion);
  }

  async crear(dto: CrearAsociacionDto): Promise<RespuestaAsociacionDto> {
    await this.verificarNitUnico(dto.nit);
    await this.verificarVereda(dto.veredaId);

    const asociacion = this.asociacionRepository.create({
      nombre: dto.nombre,
      nit: dto.nit,
      nombreRepresentante: dto.nombreRepresentante,
      telefono: dto.telefono,
      correo: dto.correo,
      vereda: { id: dto.veredaId },
    });

    const guardada = await this.asociacionRepository.save(asociacion);
    return this.obtenerUno(guardada.id);
  }

  async actualizar(
    id: string,
    dto: ActualizarAsociacionDto,
  ): Promise<RespuestaAsociacionDto> {
    const asociacion = await this.asociacionRepository.findOne({
      where: { id },
    });

    if (!asociacion) {
      throw new NotFoundException(`Asociación ${id} no encontrada`);
    }

    if (dto.nit && dto.nit !== asociacion.nit) {
      await this.verificarNitUnico(dto.nit, id);
    }

    if (dto.veredaId) {
      await this.verificarVereda(dto.veredaId);
      asociacion.vereda = { id: dto.veredaId } as Vereda;
    }

    if (dto.nombre !== undefined) asociacion.nombre = dto.nombre;
    if (dto.nit !== undefined) asociacion.nit = dto.nit;
    if (dto.nombreRepresentante !== undefined) {
      asociacion.nombreRepresentante = dto.nombreRepresentante;
    }
    if (dto.telefono !== undefined) asociacion.telefono = dto.telefono;
    if (dto.correo !== undefined) asociacion.correo = dto.correo;

    await this.asociacionRepository.save(asociacion);
    return this.obtenerUno(id);
  }

  async eliminar(id: string): Promise<void> {
    const asociacion = await this.asociacionRepository.findOne({
      where: { id },
    });

    if (!asociacion) {
      throw new NotFoundException(`Asociación ${id} no encontrada`);
    }

    asociacion.estaActivo = false;
    await this.asociacionRepository.save(asociacion);
  }

  private async verificarNitUnico(
    nit: string,
    excluirId?: string,
  ): Promise<void> {
    const query = this.asociacionRepository
      .createQueryBuilder('asociacion')
      .where('asociacion.nit = :nit', { nit });

    if (excluirId) {
      query.andWhere('asociacion.id != :excluirId', { excluirId });
    }

    const existente = await query.getOne();

    if (existente) {
      throw new ConflictException(`Ya existe una asociación con NIT ${nit}`);
    }
  }

  private async verificarVereda(veredaId: string): Promise<void> {
    const existe = await this.veredaRepository.existsBy({ id: veredaId });

    if (!existe) {
      throw new NotFoundException(`Vereda ${veredaId} no encontrada`);
    }
  }
}
