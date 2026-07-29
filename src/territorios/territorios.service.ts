import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { FiltrosVeredaDto } from './dto/filtros-vereda.dto';
import { FiltrosBusquedaTerritorioDto } from './dto/filtros-busqueda-territorio.dto';
import { RespuestaBusquedaTerritorialDto } from './dto/respuesta-busqueda-territorio.dto';
import { RespuestaNodoTerritorialDto } from './dto/respuesta-nodo-territorial.dto';
import { ResolverVeredaDto } from './dto/resolver-vereda.dto';
import {
  RespuestaPaginadaVeredasDto,
  RespuestaVeredaDto,
} from './dto/respuesta-vereda.dto';
import {
  ActualizarNodoTerritorialDto,
  CrearDepartamentoDto,
  CrearMunicipioDto,
  CrearRegionDto,
  CrearVeredaAdminDto,
} from './dto/territorio-crud.dto';
import { Departamento } from './entities/departamento.entity';
import { Municipio } from './entities/municipio.entity';
import { Region } from './entities/region.entity';
import { Vereda } from './entities/vereda.entity';
import {
  REGIONES_NATURALES,
  codigoRegionParaDepartamento,
  padCodigoDepartamento,
} from './regiones-colombia';

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
export class TerritoriosService implements OnModuleInit {
  constructor(
    @InjectRepository(Region)
    private readonly regionRepository: Repository<Region>,
    @InjectRepository(Vereda)
    private readonly veredaRepository: Repository<Vereda>,
    @InjectRepository(Municipio)
    private readonly municipioRepository: Repository<Municipio>,
    @InjectRepository(Departamento)
    private readonly departamentoRepository: Repository<Departamento>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.asegurarRegionesBase();
  }

  async asegurarRegionesBase(): Promise<void> {
    for (const r of REGIONES_NATURALES) {
      const existe = await this.regionRepository.findOne({
        where: { codigo: r.codigo },
      });
      if (existe) {
        if (!existe.descripcion && r.descripcion) {
          existe.descripcion = r.descripcion;
          await this.regionRepository.save(existe);
        }
        continue;
      }
      await this.regionRepository.save(
        this.regionRepository.create({
          nombre: r.nombre,
          codigo: r.codigo,
          descripcion: r.descripcion,
          estaActivo: true,
        }),
      );
    }
  }

  async listarVeredas(
    filtros: FiltrosVeredaDto,
  ): Promise<RespuestaPaginadaVeredasDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = Math.min(filtros.limite ?? 20, 100);
    const saltar = (pagina - 1) * limite;

    const query = this.veredaRepository
      .createQueryBuilder('vereda')
      .innerJoin('vereda.municipio', 'municipio')
      .innerJoin('municipio.departamento', 'departamento')
      .leftJoin('departamento.region', 'region')
      .where('vereda.estaActivo = true')
      .orderBy('vereda.nombre', 'ASC');

    if (filtros.busqueda?.trim()) {
      query.andWhere(
        '(vereda.nombre ILIKE :busqueda OR vereda.codigo ILIKE :busqueda OR municipio.nombre ILIKE :busqueda OR departamento.nombre ILIKE :busqueda)',
        { busqueda: `%${filtros.busqueda.trim()}%` },
      );
    }

    const [veredas, total] = await query
      .skip(saltar)
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
      totalPaginas: Math.ceil(total / limite) || 1,
    };
  }

  async resolverVereda(dto: ResolverVeredaDto): Promise<RespuestaVeredaDto> {
    const nombreVereda = dto.nombreVereda.trim();
    const municipioNombre = dto.municipio?.trim() || 'Municipio general';
    const departamentoNombre = dto.departamento?.trim() || 'Colombia';
    const latitud =
      dto.latitud != null && Number.isFinite(dto.latitud) ? dto.latitud : null;
    const longitud =
      dto.longitud != null && Number.isFinite(dto.longitud)
        ? dto.longitud
        : null;

    if (dto.placeId) {
      const codigoPlace = `gpl:${dto.placeId.slice(0, 80)}`;
      const existentePorPlace = await this.veredaRepository.findOne({
        where: { codigo: codigoPlace, estaActivo: true },
      });
      if (existentePorPlace) {
        await this.actualizarCoordenadasSiCorresponden(
          existentePorPlace,
          latitud,
          longitud,
        );
        return this.aRespuestaVereda(existentePorPlace.id);
      }
    }

    const existente = await this.veredaRepository
      .createQueryBuilder('vereda')
      .innerJoin('vereda.municipio', 'municipio')
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
      await this.actualizarCoordenadasSiCorresponden(
        existente,
        latitud,
        longitud,
      );
      return this.aRespuestaVereda(existente.id);
    }

    const departamento = await this.obtenerOCrearDepartamento(departamentoNombre);
    const municipio = await this.obtenerOCrearMunicipio(
      municipioNombre,
      departamento,
    );

    const codigoVereda = dto.placeId
      ? `gpl:${dto.placeId.slice(0, 80)}`
      : slugCodigo([departamento.codigo, municipio.codigo, nombreVereda]);

    const duplicadoCodigo = await this.veredaRepository.findOne({
      where: { codigo: codigoVereda },
    });
    if (duplicadoCodigo) {
      await this.actualizarCoordenadasSiCorresponden(
        duplicadoCodigo,
        latitud,
        longitud,
      );
      return this.aRespuestaVereda(duplicadoCodigo.id);
    }

    const vereda = await this.veredaRepository.save(
      this.veredaRepository.create({
        nombre: nombreVereda,
        codigo: codigoVereda,
        municipio,
        corregimiento: null,
        estaActivo: true,
        latitud,
        longitud,
      }),
    );

    return this.aRespuestaVereda(vereda.id);
  }

  private async actualizarCoordenadasSiCorresponden(
    vereda: Vereda,
    latitud: number | null,
    longitud: number | null,
  ): Promise<void> {
    if (latitud == null || longitud == null) return;
    if (vereda.latitud === latitud && vereda.longitud === longitud) return;
    vereda.latitud = latitud;
    vereda.longitud = longitud;
    await this.veredaRepository.save(vereda);
  }

  private async aRespuestaVereda(id: string): Promise<RespuestaVeredaDto> {
    const detalle = await this.veredaRepository.findOne({
      where: { id },
      relations: {
        municipio: { departamento: { region: true } },
        corregimiento: true,
      },
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
      municipioNombre: detalle.municipio?.nombre,
      departamentoNombre: detalle.municipio?.departamento?.nombre,
      regionNombre: detalle.municipio?.departamento?.region?.nombre,
      latitud: detalle.latitud ?? undefined,
      longitud: detalle.longitud ?? undefined,
    };
  }

  private async obtenerRegionPorCodigo(codigo: string): Promise<Region> {
    await this.asegurarRegionesBase();
    const region = await this.regionRepository.findOne({ where: { codigo } });
    if (!region) {
      throw new NotFoundException(`Región ${codigo} no encontrada`);
    }
    return region;
  }

  private async obtenerOCrearDepartamento(
    nombre: string,
  ): Promise<Departamento> {
    const existente = await this.departamentoRepository.findOne({
      where: { nombre: ILike(nombre) },
      relations: { region: true },
    });
    if (existente) return existente;

    const region = await this.obtenerRegionPorCodigo('SIN_CLASIFICAR');
    const codigo = slugCodigo(['dept', nombre]);
    try {
      return await this.departamentoRepository.save(
        this.departamentoRepository.create({
          nombre,
          codigo,
          region,
          estaActivo: true,
        }),
      );
    } catch {
      const recuperado = await this.departamentoRepository.findOne({
        where: [{ nombre: ILike(nombre) }, { codigo }],
        relations: { region: true },
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

  // --- Administración jerárquica ---

  async listarRegiones(
    incluirInactivos = false,
  ): Promise<RespuestaNodoTerritorialDto[]> {
    await this.asegurarRegionesBase();
    const query = this.regionRepository
      .createQueryBuilder('region')
      .orderBy('region.nombre', 'ASC');
    if (!incluirInactivos) {
      query.where('region.estaActivo = true');
    }
    const filas = await query.getMany();
    return Promise.all(
      filas.map(async (r) => ({
        id: r.id,
        nombre: r.nombre,
        codigo: r.codigo,
        estaActivo: r.estaActivo,
        conteoHijos: await this.departamentoRepository.count({
          where: { region: { id: r.id } },
        }),
      })),
    );
  }

  async crearRegion(dto: CrearRegionDto): Promise<RespuestaNodoTerritorialDto> {
    const nombre = dto.nombre.trim();
    const codigo = (dto.codigo?.trim() || slugCodigo(['reg', nombre]))
      .toUpperCase()
      .slice(0, 80);
    await this.asegurarCodigoLibre('region', codigo);
    const guardado = await this.regionRepository.save(
      this.regionRepository.create({
        nombre,
        codigo,
        descripcion: dto.descripcion?.trim() || null,
        estaActivo: true,
      }),
    );
    return {
      id: guardado.id,
      nombre: guardado.nombre,
      codigo: guardado.codigo,
      estaActivo: guardado.estaActivo,
      conteoHijos: 0,
    };
  }

  async actualizarRegion(
    id: string,
    dto: ActualizarNodoTerritorialDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    const nodo = await this.regionRepository.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException('Región no encontrada');
    if (dto.nombre !== undefined) nodo.nombre = dto.nombre.trim();
    if (dto.codigo !== undefined && dto.codigo.trim() !== nodo.codigo) {
      await this.asegurarCodigoLibre('region', dto.codigo.trim(), id);
      nodo.codigo = dto.codigo.trim().toUpperCase();
    }
    if (dto.descripcion !== undefined) {
      nodo.descripcion = dto.descripcion.trim() || null;
    }
    if (dto.estaActivo !== undefined) nodo.estaActivo = dto.estaActivo;
    const guardado = await this.regionRepository.save(nodo);
    const conteo = await this.departamentoRepository.count({
      where: { region: { id } },
    });
    return {
      id: guardado.id,
      nombre: guardado.nombre,
      codigo: guardado.codigo,
      estaActivo: guardado.estaActivo,
      conteoHijos: conteo,
    };
  }

  async desactivarRegion(id: string): Promise<void> {
    const nodo = await this.regionRepository.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException('Región no encontrada');
    if (nodo.codigo === 'SIN_CLASIFICAR') {
      throw new BadRequestException(
        'La región Sin clasificar no se puede desactivar',
      );
    }
    nodo.estaActivo = false;
    await this.regionRepository.save(nodo);
  }

  async listarDepartamentos(
    regionId?: string,
    incluirInactivos = false,
  ): Promise<RespuestaNodoTerritorialDto[]> {
    const query = this.departamentoRepository
      .createQueryBuilder('departamento')
      .orderBy('departamento.nombre', 'ASC');
    if (regionId) {
      query.where('departamento.region_id = :regionId', { regionId });
    }
    if (!incluirInactivos) {
      query.andWhere('departamento.estaActivo = true');
    }
    const filas = await query.getMany();
    return Promise.all(
      filas.map(async (d) => ({
        id: d.id,
        nombre: d.nombre,
        codigo: d.codigo,
        estaActivo: d.estaActivo,
        padreId: regionId,
        conteoHijos: await this.municipioRepository.count({
          where: { departamento: { id: d.id } },
        }),
      })),
    );
  }

  async crearDepartamento(
    dto: CrearDepartamentoDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    const region = await this.asegurarRegion(dto.regionId);
    const nombre = dto.nombre.trim();
    const codigoRaw = dto.codigo?.trim() || slugCodigo(['dept', nombre]);
    const codigo =
      /^\d+$/.test(codigoRaw) && codigoRaw.length <= 2
        ? padCodigoDepartamento(codigoRaw)
        : codigoRaw.slice(0, 80);
    await this.asegurarCodigoLibre('departamento', codigo);
    const guardado = await this.departamentoRepository.save(
      this.departamentoRepository.create({
        nombre,
        codigo,
        region,
        estaActivo: true,
      }),
    );
    return {
      id: guardado.id,
      nombre: guardado.nombre,
      codigo: guardado.codigo,
      estaActivo: guardado.estaActivo,
      padreId: region.id,
      conteoHijos: 0,
    };
  }

  async actualizarDepartamento(
    id: string,
    dto: ActualizarNodoTerritorialDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    const nodo = await this.departamentoRepository.findOne({
      where: { id },
      relations: { region: true },
    });
    if (!nodo) throw new NotFoundException('Departamento no encontrado');
    if (dto.nombre !== undefined) nodo.nombre = dto.nombre.trim();
    if (dto.codigo !== undefined && dto.codigo.trim() !== nodo.codigo) {
      await this.asegurarCodigoLibre('departamento', dto.codigo.trim(), id);
      nodo.codigo = dto.codigo.trim();
    }
    if (dto.regionId) {
      nodo.region = await this.asegurarRegion(dto.regionId);
    }
    if (dto.estaActivo !== undefined) nodo.estaActivo = dto.estaActivo;
    const guardado = await this.departamentoRepository.save(nodo);
    const conteo = await this.municipioRepository.count({
      where: { departamento: { id } },
    });
    return {
      id: guardado.id,
      nombre: guardado.nombre,
      codigo: guardado.codigo,
      estaActivo: guardado.estaActivo,
      padreId: nodo.region.id,
      conteoHijos: conteo,
    };
  }

  async desactivarDepartamento(id: string): Promise<void> {
    const nodo = await this.departamentoRepository.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException('Departamento no encontrado');
    nodo.estaActivo = false;
    await this.departamentoRepository.save(nodo);
  }

  async listarMunicipios(
    departamentoId: string,
    incluirInactivos = false,
  ): Promise<RespuestaNodoTerritorialDto[]> {
    await this.asegurarDepartamento(departamentoId);
    const query = this.municipioRepository
      .createQueryBuilder('municipio')
      .where('municipio.departamento_id = :departamentoId', { departamentoId })
      .orderBy('municipio.nombre', 'ASC');
    if (!incluirInactivos) {
      query.andWhere('municipio.estaActivo = true');
    }
    const filas = await query.getMany();
    return Promise.all(
      filas.map(async (m) => ({
        id: m.id,
        nombre: m.nombre,
        codigo: m.codigo,
        estaActivo: m.estaActivo,
        padreId: departamentoId,
        conteoHijos: await this.veredaRepository.count({
          where: { municipio: { id: m.id } },
        }),
      })),
    );
  }

  async crearMunicipio(
    dto: CrearMunicipioDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    const departamento = await this.asegurarDepartamento(dto.departamentoId);
    const nombre = dto.nombre.trim();
    const codigo = (
      dto.codigo?.trim() || slugCodigo([departamento.codigo, 'mun', nombre])
    ).slice(0, 80);
    await this.asegurarCodigoLibre('municipio', codigo);
    const guardado = await this.municipioRepository.save(
      this.municipioRepository.create({
        nombre,
        codigo,
        departamento,
        estaActivo: true,
      }),
    );
    return {
      id: guardado.id,
      nombre: guardado.nombre,
      codigo: guardado.codigo,
      estaActivo: guardado.estaActivo,
      padreId: departamento.id,
      conteoHijos: 0,
    };
  }

  async actualizarMunicipio(
    id: string,
    dto: ActualizarNodoTerritorialDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    const nodo = await this.municipioRepository.findOne({
      where: { id },
      relations: { departamento: true },
    });
    if (!nodo) throw new NotFoundException('Municipio no encontrado');
    if (dto.nombre !== undefined) nodo.nombre = dto.nombre.trim();
    if (dto.codigo !== undefined && dto.codigo.trim() !== nodo.codigo) {
      await this.asegurarCodigoLibre('municipio', dto.codigo.trim(), id);
      nodo.codigo = dto.codigo.trim();
    }
    if (dto.estaActivo !== undefined) nodo.estaActivo = dto.estaActivo;
    const guardado = await this.municipioRepository.save(nodo);
    const conteo = await this.veredaRepository.count({
      where: { municipio: { id } },
    });
    return {
      id: guardado.id,
      nombre: guardado.nombre,
      codigo: guardado.codigo,
      estaActivo: guardado.estaActivo,
      padreId: nodo.departamento.id,
      conteoHijos: conteo,
    };
  }

  async desactivarMunicipio(id: string): Promise<void> {
    const nodo = await this.municipioRepository.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException('Municipio no encontrado');
    nodo.estaActivo = false;
    await this.municipioRepository.save(nodo);
  }

  async listarVeredasPorMunicipio(
    municipioId: string,
    incluirInactivos = false,
  ): Promise<RespuestaNodoTerritorialDto[]> {
    await this.asegurarMunicipio(municipioId);
    const query = this.veredaRepository
      .createQueryBuilder('vereda')
      .where('vereda.municipio_id = :municipioId', { municipioId })
      .orderBy('vereda.nombre', 'ASC');
    if (!incluirInactivos) {
      query.andWhere('vereda.estaActivo = true');
    }
    const filas = await query.getMany();
    return filas.map((v) => ({
      id: v.id,
      nombre: v.nombre,
      codigo: v.codigo,
      estaActivo: v.estaActivo,
      padreId: municipioId,
      conteoHijos: 0,
    }));
  }

  async crearVeredaAdmin(
    dto: CrearVeredaAdminDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    const municipio = await this.asegurarMunicipio(dto.municipioId);
    const nombre = dto.nombre.trim();
    const codigo = (
      dto.codigo?.trim() || slugCodigo([municipio.codigo, nombre])
    ).slice(0, 80);
    await this.asegurarCodigoLibre('vereda', codigo);
    const guardado = await this.veredaRepository.save(
      this.veredaRepository.create({
        nombre,
        codigo,
        municipio,
        corregimiento: null,
        estaActivo: true,
      }),
    );
    return {
      id: guardado.id,
      nombre: guardado.nombre,
      codigo: guardado.codigo,
      estaActivo: guardado.estaActivo,
      padreId: municipio.id,
      conteoHijos: 0,
    };
  }

  async actualizarVeredaAdmin(
    id: string,
    dto: ActualizarNodoTerritorialDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    const nodo = await this.veredaRepository.findOne({
      where: { id },
      relations: { municipio: true },
    });
    if (!nodo) throw new NotFoundException('Vereda no encontrada');
    if (dto.nombre !== undefined) nodo.nombre = dto.nombre.trim();
    if (dto.codigo !== undefined && dto.codigo.trim() !== nodo.codigo) {
      await this.asegurarCodigoLibre('vereda', dto.codigo.trim(), id);
      nodo.codigo = dto.codigo.trim();
    }
    if (dto.estaActivo !== undefined) nodo.estaActivo = dto.estaActivo;
    const guardado = await this.veredaRepository.save(nodo);
    return {
      id: guardado.id,
      nombre: guardado.nombre,
      codigo: guardado.codigo,
      estaActivo: guardado.estaActivo,
      padreId: nodo.municipio.id,
      conteoHijos: 0,
    };
  }

  async desactivarVereda(id: string): Promise<void> {
    const nodo = await this.veredaRepository.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException('Vereda no encontrada');
    nodo.estaActivo = false;
    await this.veredaRepository.save(nodo);
  }

  /** Asigna región según código DANE del departamento (para imports). */
  async resolverRegionParaCodigoDepartamento(
    codigoDpto: string,
  ): Promise<Region> {
    const codigoRegion = codigoRegionParaDepartamento(codigoDpto);
    return this.obtenerRegionPorCodigo(codigoRegion);
  }

  private async asegurarRegion(id: string): Promise<Region> {
    const nodo = await this.regionRepository.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException('Región no encontrada');
    return nodo;
  }

  private async asegurarDepartamento(id: string): Promise<Departamento> {
    const nodo = await this.departamentoRepository.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException('Departamento no encontrado');
    return nodo;
  }

  private async asegurarMunicipio(id: string): Promise<Municipio> {
    const nodo = await this.municipioRepository.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException('Municipio no encontrado');
    return nodo;
  }

  private async asegurarCodigoLibre(
    tipo: 'region' | 'departamento' | 'municipio' | 'vereda',
    codigo: string,
    exceptoId?: string,
  ): Promise<void> {
    if (!codigo) {
      throw new BadRequestException('El código es obligatorio');
    }
    const repo =
      tipo === 'region'
        ? this.regionRepository
        : tipo === 'departamento'
          ? this.departamentoRepository
          : tipo === 'municipio'
            ? this.municipioRepository
            : this.veredaRepository;
    const existente = await repo.findOne({ where: { codigo } as never });
    if (existente && (existente as { id: string }).id !== exceptoId) {
      throw new ConflictException(`Ya existe un código "${codigo}"`);
    }
  }

  async buscarTerritorios(
    filtros: FiltrosBusquedaTerritorioDto,
  ): Promise<RespuestaBusquedaTerritorialDto[]> {
    const termino = filtros.q?.trim() ?? '';
    if (termino.length < 2) {
      return [];
    }

    const limite = Math.min(filtros.limite ?? 30, 50);
    const incluirInactivos = filtros.incluirInactivos ?? true;
    const porNivel = Math.max(5, Math.ceil(limite / 4));
    const patron = `%${termino}%`;
    const resultados: RespuestaBusquedaTerritorialDto[] = [];

    const regiones = await this.regionRepository
      .createQueryBuilder('region')
      .where('(region.nombre ILIKE :patron OR region.codigo ILIKE :patron)', {
        patron,
      })
      .andWhere(incluirInactivos ? '1=1' : 'region.estaActivo = true')
      .orderBy('region.nombre', 'ASC')
      .take(porNivel)
      .getMany();

    for (const region of regiones) {
      resultados.push({
        nivel: 'region',
        id: region.id,
        nombre: region.nombre,
        codigo: region.codigo,
        estaActivo: region.estaActivo,
        ruta: region.nombre,
        regionId: region.id,
      });
    }

    const departamentos = await this.departamentoRepository
      .createQueryBuilder('departamento')
      .innerJoinAndSelect('departamento.region', 'region')
      .where(
        '(departamento.nombre ILIKE :patron OR departamento.codigo ILIKE :patron)',
        { patron },
      )
      .andWhere(incluirInactivos ? '1=1' : 'departamento.estaActivo = true')
      .orderBy('departamento.nombre', 'ASC')
      .take(porNivel)
      .getMany();

    for (const departamento of departamentos) {
      const region = departamento.region;
      resultados.push({
        nivel: 'departamento',
        id: departamento.id,
        nombre: departamento.nombre,
        codigo: departamento.codigo,
        estaActivo: departamento.estaActivo,
        ruta: region ? `${region.nombre} › ${departamento.nombre}` : departamento.nombre,
        regionId: region?.id,
        departamentoId: departamento.id,
      });
    }

    const municipios = await this.municipioRepository
      .createQueryBuilder('municipio')
      .innerJoinAndSelect('municipio.departamento', 'departamento')
      .leftJoinAndSelect('departamento.region', 'region')
      .where(
        '(municipio.nombre ILIKE :patron OR municipio.codigo ILIKE :patron)',
        { patron },
      )
      .andWhere(incluirInactivos ? '1=1' : 'municipio.estaActivo = true')
      .orderBy('municipio.nombre', 'ASC')
      .take(porNivel)
      .getMany();

    for (const municipio of municipios) {
      const departamento = municipio.departamento;
      const region = departamento?.region;
      const partes = [region?.nombre, departamento?.nombre, municipio.nombre].filter(
        Boolean,
      );
      resultados.push({
        nivel: 'municipio',
        id: municipio.id,
        nombre: municipio.nombre,
        codigo: municipio.codigo,
        estaActivo: municipio.estaActivo,
        ruta: partes.join(' › '),
        regionId: region?.id,
        departamentoId: departamento?.id,
        municipioId: municipio.id,
      });
    }

    const veredas = await this.veredaRepository
      .createQueryBuilder('vereda')
      .innerJoinAndSelect('vereda.municipio', 'municipio')
      .innerJoinAndSelect('municipio.departamento', 'departamento')
      .leftJoinAndSelect('departamento.region', 'region')
      .where('(vereda.nombre ILIKE :patron OR vereda.codigo ILIKE :patron)', {
        patron,
      })
      .andWhere(incluirInactivos ? '1=1' : 'vereda.estaActivo = true')
      .orderBy('vereda.nombre', 'ASC')
      .take(porNivel)
      .getMany();

    for (const vereda of veredas) {
      const municipio = vereda.municipio;
      const departamento = municipio?.departamento;
      const region = departamento?.region;
      const partes = [
        region?.nombre,
        departamento?.nombre,
        municipio?.nombre,
        vereda.nombre,
      ].filter(Boolean);
      resultados.push({
        nivel: 'vereda',
        id: vereda.id,
        nombre: vereda.nombre,
        codigo: vereda.codigo,
        estaActivo: vereda.estaActivo,
        ruta: partes.join(' › '),
        regionId: region?.id,
        departamentoId: departamento?.id,
        municipioId: municipio?.id,
        veredaId: vereda.id,
      });
    }

    return resultados
      .sort((a, b) => {
        const exactoA = a.nombre.toLowerCase() === termino.toLowerCase();
        const exactoB = b.nombre.toLowerCase() === termino.toLowerCase();
        if (exactoA !== exactoB) return exactoA ? -1 : 1;
        return a.nombre.localeCompare(b.nombre, 'es');
      })
      .slice(0, limite);
  }
}
