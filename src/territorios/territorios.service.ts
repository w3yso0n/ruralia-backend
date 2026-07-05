import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { FiltrosVeredaDto } from './dto/filtros-vereda.dto';
import { ResolverVeredaDto } from './dto/resolver-vereda.dto';
import {
  RespuestaPaginadaVeredasDto,
  RespuestaVeredaDto,
} from './dto/respuesta-vereda.dto';
import { Corregimiento } from './entities/corregimiento.entity';
import { Departamento } from './entities/departamento.entity';
import { Municipio } from './entities/municipio.entity';
import { Vereda } from './entities/vereda.entity';

function slugCodigo(partes: string[]): string {
  const base = partes
    .filter(Boolean)
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

  return base || 'territorio';
}

@Injectable()
export class TerritoriosService {
  constructor(
    @InjectRepository(Vereda)
    private readonly veredaRepository: Repository<Vereda>,
    @InjectRepository(Corregimiento)
    private readonly corregimientoRepository: Repository<Corregimiento>,
    @InjectRepository(Municipio)
    private readonly municipioRepository: Repository<Municipio>,
    @InjectRepository(Departamento)
    private readonly departamentoRepository: Repository<Departamento>,
  ) {}

  async listarVeredas(
    filtros: FiltrosVeredaDto,
  ): Promise<RespuestaPaginadaVeredasDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 50;
    const skip = (pagina - 1) * limite;

    const query = this.veredaRepository
      .createQueryBuilder('vereda')
      .innerJoin('vereda.corregimiento', 'corregimiento')
      .innerJoin('corregimiento.municipio', 'municipio')
      .where('vereda.estaActivo = true')
      .orderBy('vereda.nombre', 'ASC');

    if (filtros.municipioId) {
      query.andWhere('municipio.id = :municipioId', {
        municipioId: filtros.municipioId,
      });
    }

    if (filtros.busqueda) {
      query.andWhere(
        '(vereda.nombre ILIKE :busqueda OR vereda.codigo ILIKE :busqueda OR municipio.nombre ILIKE :busqueda OR corregimiento.nombre ILIKE :busqueda)',
        { busqueda: `%${filtros.busqueda}%` },
      );
    }

    const [veredas, total] = await query
      .skip(skip)
      .take(limite)
      .getManyAndCount();

    const datos: RespuestaVeredaDto[] = [];

    for (const vereda of veredas) {
      datos.push(await this.aRespuestaVereda(vereda.id));
    }

    return {
      datos,
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite) || 0,
    };
  }

  async resolverVereda(dto: ResolverVeredaDto): Promise<RespuestaVeredaDto> {
    const nombreVereda = dto.nombreVereda.trim();
    const municipioNombre = dto.municipio?.trim() || 'Municipio general';
    const departamentoNombre = dto.departamento?.trim() || 'Colombia';
    const corregimientoNombre =
      dto.corregimiento?.trim() || `Corregimiento ${municipioNombre}`;

    if (dto.placeId) {
      const codigoPlace = `gpl:${dto.placeId.slice(0, 80)}`;
      const existentePorPlace = await this.veredaRepository.findOne({
        where: { codigo: codigoPlace, estaActivo: true },
      });
      if (existentePorPlace) {
        return this.aRespuestaVereda(existentePorPlace.id);
      }
    }

    const existente = await this.veredaRepository
      .createQueryBuilder('vereda')
      .innerJoin('vereda.corregimiento', 'corregimiento')
      .innerJoin('corregimiento.municipio', 'municipio')
      .innerJoin('municipio.departamento', 'departamento')
      .where('vereda.estaActivo = true')
      .andWhere('vereda.nombre ILIKE :nombreVereda', { nombreVereda })
      .andWhere('municipio.nombre ILIKE :municipio', {
        municipio: municipioNombre,
      })
      .andWhere('departamento.nombre ILIKE :departamento', {
        departamento: departamentoNombre,
      })
      .getOne();

    if (existente) {
      return this.aRespuestaVereda(existente.id);
    }

    const departamento = await this.obtenerOCrearDepartamento(departamentoNombre);
    const municipio = await this.obtenerOCrearMunicipio(
      municipioNombre,
      departamento,
    );
    const corregimiento = await this.obtenerOCrearCorregimiento(
      corregimientoNombre,
      municipio,
    );

    const codigoVereda = dto.placeId
      ? `gpl:${dto.placeId.slice(0, 80)}`
      : slugCodigo([
          departamento.codigo,
          municipio.codigo,
          corregimiento.codigo,
          nombreVereda,
        ]);

    const duplicadoCodigo = await this.veredaRepository.findOne({
      where: { codigo: codigoVereda },
    });
    if (duplicadoCodigo) {
      return this.aRespuestaVereda(duplicadoCodigo.id);
    }

    const vereda = await this.veredaRepository.save(
      this.veredaRepository.create({
        nombre: nombreVereda,
        codigo: codigoVereda,
        corregimiento,
        estaActivo: true,
      }),
    );

    return this.aRespuestaVereda(vereda.id);
  }

  private async aRespuestaVereda(id: string): Promise<RespuestaVeredaDto> {
    const detalle = await this.veredaRepository.findOne({
      where: { id },
      relations: { corregimiento: { municipio: { departamento: true } } },
    });

    if (!detalle) {
      throw new NotFoundException(`Vereda con id ${id} no encontrada`);
    }

    return {
      id: detalle.id,
      nombre: detalle.nombre,
      codigo: detalle.codigo,
      estaActivo: detalle.estaActivo,
      corregimientoNombre: detalle.corregimiento?.nombre,
      municipioNombre: detalle.corregimiento?.municipio?.nombre,
      departamentoNombre: detalle.corregimiento?.municipio?.departamento?.nombre,
    };
  }

  private async obtenerOCrearDepartamento(
    nombre: string,
  ): Promise<Departamento> {
    const existente = await this.departamentoRepository.findOne({
      where: { nombre: ILike(nombre) },
    });
    if (existente) return existente;

    const codigo = slugCodigo(['dept', nombre]);
    try {
      return await this.departamentoRepository.save(
        this.departamentoRepository.create({
          nombre,
          codigo,
          estaActivo: true,
        }),
      );
    } catch {
      const recuperado = await this.departamentoRepository.findOne({
        where: [{ nombre: ILike(nombre) }, { codigo }],
      });
      if (recuperado) return recuperado;
      throw new ConflictException('No se pudo registrar el departamento');
    }
  }

  private async obtenerOCrearMunicipio(
    nombre: string,
    departamento: Departamento,
  ): Promise<Municipio> {
    const existente = await this.municipioRepository.findOne({
      where: { nombre: ILike(nombre), departamento: { id: departamento.id } },
    });
    if (existente) return existente;

    const codigo = slugCodigo([departamento.codigo, 'mun', nombre]);
    try {
      return await this.municipioRepository.save(
        this.municipioRepository.create({
          nombre,
          codigo,
          departamento,
          estaActivo: true,
        }),
      );
    } catch {
      const recuperado = await this.municipioRepository.findOne({
        where: { codigo },
        relations: { departamento: true },
      });
      if (recuperado) return recuperado;
      throw new ConflictException('No se pudo registrar el municipio');
    }
  }

  private async obtenerOCrearCorregimiento(
    nombre: string,
    municipio: Municipio,
  ): Promise<Corregimiento> {
    const existente = await this.corregimientoRepository.findOne({
      where: { nombre: ILike(nombre), municipio: { id: municipio.id } },
    });
    if (existente) return existente;

    const codigo = slugCodigo([municipio.codigo, 'corr', nombre]);
    try {
      return await this.corregimientoRepository.save(
        this.corregimientoRepository.create({
          nombre,
          codigo,
          municipio,
          estaActivo: true,
        }),
      );
    } catch {
      const recuperado = await this.corregimientoRepository.findOne({
        where: { codigo },
        relations: { municipio: true },
      });
      if (recuperado) return recuperado;
      throw new ConflictException('No se pudo registrar el corregimiento');
    }
  }
}
