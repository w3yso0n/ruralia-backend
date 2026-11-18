import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Municipio } from './entities/municipio.entity';
import { VeredaPdet } from './entities/vereda-pdet.entity';
import { Vereda } from './entities/vereda.entity';
import {
  CAMPOS_MAPEO_PDET,
  type ActualizarVeredaPdetDto,
  type CampoMapeoPdet,
  type CrearVeredaPdetDto,
  type FiltrosVeredaPdetDto,
  type MapeoVeredasPdet,
} from './dto/vereda-pdet.dto';
import {
  leerTabla,
  normalizarTitulo,
  type TablaLeida,
} from './utils/tabla-importacion';

export type AccionFilaPdet = 'CREAR' | 'ACTUALIZAR' | 'SIN_CAMBIOS' | 'ERROR';

export interface FilaPreviewPdet {
  fila: number;
  codigo: string;
  nombre: string;
  subregion: string | null;
  municipio: {
    id: string;
    codigo: string;
    nombre: string;
    departamento: string;
  } | null;
  veredaDane: { id: string; codigo: string; nombre: string } | null;
  accion: AccionFilaPdet;
  errores: string[];
}

/** Palabras que identifican cada campo en el título de la columna, de lo más específico a lo general. */
function sugerirCampo(
  titulo: string,
  usados: Set<CampoMapeoPdet>,
): CampoMapeoPdet | null {
  const t = normalizarTitulo(titulo);
  const tiene = (...palabras: string[]) => palabras.some((p) => t.includes(p));
  const esCodigo = tiene('cod', 'dane', 'divipola', 'id ');
  const candidatos: Array<[CampoMapeoPdet, boolean]> = [
    ['subregion', tiene('subregion', 'sub region')],
    ['municipioCodigo', tiene('municipio', 'mpio', 'munic') && esCodigo],
    ['veredaDaneCodigo', tiene('vereda') && tiene('dane') && esCodigo],
    ['departamento', tiene('departamento', 'depto', 'dpto') && !esCodigo],
    ['municipio', tiene('municipio', 'mpio', 'munic') && !esCodigo],
    [
      'codigo',
      esCodigo && !tiene('municipio', 'mpio', 'departamento', 'depto', 'dpto'),
    ],
    ['nombre', tiene('vereda', 'nombre', 'nucleo')],
  ];
  for (const [campo, coincide] of candidatos) {
    if (coincide && !usados.has(campo)) return campo;
  }
  return null;
}

function codigoMunicipio(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 4 ? `0${digitos}` : digitos;
}

/**
 * Catálogo de veredas PDET: CRUD, importación desde Excel/CSV con mapeo de
 * columnas (aún no conocemos el formato exacto del archivo del cliente) y
 * catálogo compacto para la app (offline).
 */
@Injectable()
export class VeredasPdetService {
  constructor(
    @InjectRepository(VeredaPdet)
    private readonly veredaPdetRepository: Repository<VeredaPdet>,
    @InjectRepository(Municipio)
    private readonly municipioRepository: Repository<Municipio>,
    @InjectRepository(Vereda)
    private readonly veredaRepository: Repository<Vereda>,
    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // Consulta y CRUD
  // -------------------------------------------------------------------------

  async listar(filtros: FiltrosVeredaPdetDto) {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 50;
    const qb = this.veredaPdetRepository
      .createQueryBuilder('vp')
      .innerJoinAndSelect('vp.municipio', 'municipio')
      .innerJoinAndSelect('municipio.departamento', 'departamento')
      .leftJoinAndSelect('vp.veredaDane', 'veredaDane')
      .orderBy('departamento.nombre', 'ASC')
      .addOrderBy('municipio.nombre', 'ASC')
      .addOrderBy('vp.nombre', 'ASC')
      .skip((pagina - 1) * limite)
      .take(limite);
    if (!filtros.incluirInactivas) qb.andWhere('vp.estaActivo = true');
    if (filtros.municipioId) {
      qb.andWhere('municipio.id = :municipioId', {
        municipioId: filtros.municipioId,
      });
    }
    if (filtros.departamentoId) {
      qb.andWhere('departamento.id = :departamentoId', {
        departamentoId: filtros.departamentoId,
      });
    }
    if (filtros.busqueda?.trim()) {
      qb.andWhere('(vp.nombre ILIKE :b OR vp.codigo ILIKE :b)', {
        b: `%${filtros.busqueda.trim()}%`,
      });
    }
    const [datos, total] = await qb.getManyAndCount();
    return {
      datos: datos.map((v) => this.aRespuesta(v)),
      total,
      pagina,
      limite,
    };
  }

  async crear(dto: CrearVeredaPdetDto) {
    const [municipio, veredaDane] = await Promise.all([
      this.municipioRepository.findOne({ where: { id: dto.municipioId } }),
      dto.veredaDaneId
        ? this.veredaRepository.findOne({
            where: { id: dto.veredaDaneId },
            relations: { municipio: true },
          })
        : Promise.resolve(null),
    ]);
    if (!municipio) throw new NotFoundException('Municipio no encontrado');
    this.validarVeredaDane(veredaDane, municipio.id, dto.veredaDaneId);
    const existe = await this.veredaPdetRepository.exists({
      where: { municipio: { id: municipio.id }, codigo: dto.codigo.trim() },
    });
    if (existe) {
      throw new ConflictException(
        'Ya existe una vereda PDET con ese código en el municipio.',
      );
    }
    const guardada = await this.veredaPdetRepository.save(
      this.veredaPdetRepository.create({
        codigo: dto.codigo.trim(),
        nombre: dto.nombre.trim(),
        subregion: dto.subregion?.trim() || null,
        municipio,
        veredaDane,
        estaActivo: true,
      }),
    );
    return this.obtener(guardada.id);
  }

  async actualizar(id: string, dto: ActualizarVeredaPdetDto) {
    const actual = await this.veredaPdetRepository.findOne({
      where: { id },
      relations: { municipio: true },
    });
    if (!actual) throw new NotFoundException('Vereda PDET no encontrada');
    if (dto.veredaDaneId !== undefined) {
      const veredaDane = dto.veredaDaneId
        ? await this.veredaRepository.findOne({
            where: { id: dto.veredaDaneId },
            relations: { municipio: true },
          })
        : null;
      this.validarVeredaDane(veredaDane, actual.municipio.id, dto.veredaDaneId);
      actual.veredaDane = veredaDane;
    }
    if (dto.nombre !== undefined) actual.nombre = dto.nombre.trim();
    if (dto.subregion !== undefined)
      actual.subregion = dto.subregion?.trim() || null;
    if (dto.estaActivo !== undefined) actual.estaActivo = dto.estaActivo;
    await this.veredaPdetRepository.save(actual);
    return this.obtener(id);
  }

  async obtener(id: string) {
    const vereda = await this.veredaPdetRepository.findOne({
      where: { id },
      relations: { municipio: { departamento: true }, veredaDane: true },
    });
    if (!vereda) throw new NotFoundException('Vereda PDET no encontrada');
    return this.aRespuesta(vereda);
  }

  /**
   * Catálogo compacto para la app: departamento -> municipio -> veredas PDET
   * activas. Con proyecto, solo los municipios del proyecto (municipios,
   * veredas DANE y veredas de sus beneficiarios); si no tiene ninguno, todo.
   */
  async catalogo(proyectoId?: string) {
    let municipioIds: string[] | null = null;
    if (proyectoId) {
      const filas = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT pm.municipio_id AS id FROM proyecto_municipios pm WHERE pm.proyecto_id = $1
         UNION
         SELECT v.municipio_id FROM proyecto_veredas pv JOIN veredas v ON v.id = pv.vereda_id WHERE pv.proyecto_id = $1
         UNION
         SELECT v.municipio_id FROM proyecto_beneficiarios pb
           JOIN beneficiarios b ON b.id = pb.beneficiario_id
           JOIN veredas v ON v.id = b.vereda_id
           WHERE pb.proyecto_id = $1`,
        [proyectoId],
      );
      municipioIds = filas.length ? filas.map((f) => f.id) : null;
    }
    const veredas = await this.veredaPdetRepository.find({
      where: {
        estaActivo: true,
        ...(municipioIds ? { municipio: { id: In(municipioIds) } } : {}),
      },
      relations: { municipio: { departamento: true } },
      order: { nombre: 'ASC' },
    });

    const departamentos = new Map<
      string,
      {
        id: string;
        codigo: string;
        nombre: string;
        municipios: Map<
          string,
          {
            id: string;
            codigo: string;
            nombre: string;
            veredas: Array<{ id: string; codigo: string; nombre: string }>;
          }
        >;
      }
    >();
    for (const v of veredas) {
      const dep = v.municipio.departamento;
      if (!departamentos.has(dep.id)) {
        departamentos.set(dep.id, {
          id: dep.id,
          codigo: dep.codigo,
          nombre: dep.nombre,
          municipios: new Map(),
        });
      }
      const municipios = departamentos.get(dep.id)!.municipios;
      if (!municipios.has(v.municipio.id)) {
        municipios.set(v.municipio.id, {
          id: v.municipio.id,
          codigo: v.municipio.codigo,
          nombre: v.municipio.nombre,
          veredas: [],
        });
      }
      municipios.get(v.municipio.id)!.veredas.push({
        id: v.id,
        codigo: v.codigo,
        nombre: v.nombre,
      });
    }
    return {
      actualizadoEn: new Date().toISOString(),
      total: veredas.length,
      departamentos: [...departamentos.values()]
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((d) => ({
          ...d,
          municipios: [...d.municipios.values()].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es'),
          ),
        })),
    };
  }

  // -------------------------------------------------------------------------
  // Importación
  // -------------------------------------------------------------------------

  /** Lee el archivo sin guardar y propone a qué campo va cada columna. */
  async analizar(buffer: Buffer, nombreArchivo?: string) {
    const tabla = await leerTabla(buffer, nombreArchivo);
    const usados = new Set<CampoMapeoPdet>();
    const columnas = tabla.encabezados.map((encabezado, i) => {
      const campo = sugerirCampo(encabezado, usados);
      if (campo) usados.add(campo);
      return {
        columna: i + 1,
        encabezado,
        muestras: tabla.filas
          .slice(0, 3)
          .map((f) => f.celdas[i] ?? '')
          .filter(Boolean),
        sugerencia: campo,
      };
    });
    const mapeo: MapeoVeredasPdet = {
      filaEncabezado: tabla.filaEncabezado,
      columnas: Object.fromEntries(
        columnas
          .filter((c) => c.sugerencia)
          .map((c) => [c.sugerencia!, c.columna]),
      ),
    };
    return {
      filaEncabezado: tabla.filaEncabezado,
      totalFilas: tabla.filas.length,
      campos: CAMPOS_MAPEO_PDET,
      columnas,
      mapeoSugerido: mapeo,
    };
  }

  async previsualizar(
    buffer: Buffer,
    mapeo: MapeoVeredasPdet,
    nombreArchivo?: string,
  ) {
    const tabla = await leerTabla(buffer, nombreArchivo, mapeo.filaEncabezado);
    const filas = await this.resolverFilas(tabla, mapeo);
    return { filas, totales: this.totales(filas) };
  }

  async importar(
    buffer: Buffer,
    mapeo: MapeoVeredasPdet,
    nombreArchivo?: string,
  ) {
    const tabla = await leerTabla(buffer, nombreArchivo, mapeo.filaEncabezado);
    const filas = await this.resolverFilas(tabla, mapeo);
    const aplicables = filas.filter(
      (f) => f.accion === 'CREAR' || f.accion === 'ACTUALIZAR',
    );
    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < aplicables.length; i += 500) {
        const lote = aplicables.slice(i, i + 500);
        await manager.query(
          `INSERT INTO veredas_pdet (codigo, nombre, subregion, municipio_id, vereda_dane_id, esta_activo)
           SELECT * FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::uuid[], $5::uuid[], $6::boolean[])
           ON CONFLICT ON CONSTRAINT "UQ_veredas_pdet_municipio_codigo" DO UPDATE
             SET nombre = EXCLUDED.nombre,
                 subregion = EXCLUDED.subregion,
                 vereda_dane_id = EXCLUDED.vereda_dane_id,
                 esta_activo = true`,
          [
            lote.map((f) => f.codigo),
            lote.map((f) => f.nombre),
            lote.map((f) => f.subregion),
            lote.map((f) => f.municipio!.id),
            lote.map((f) => f.veredaDane?.id ?? null),
            lote.map(() => true),
          ],
        );
      }
    });
    return {
      totales: this.totales(filas),
      errores: filas.filter((f) => f.accion === 'ERROR'),
    };
  }

  private totales(filas: FilaPreviewPdet[]) {
    const contar = (a: AccionFilaPdet) =>
      filas.filter((f) => f.accion === a).length;
    return {
      filas: filas.length,
      crear: contar('CREAR'),
      actualizar: contar('ACTUALIZAR'),
      sinCambios: contar('SIN_CAMBIOS'),
      errores: contar('ERROR'),
    };
  }

  private async resolverFilas(
    tabla: TablaLeida,
    mapeo: MapeoVeredasPdet,
  ): Promise<FilaPreviewPdet[]> {
    const col = mapeo.columnas;
    if (!col.nombre) {
      throw new BadRequestException(
        'Indica qué columna tiene el nombre de la vereda PDET.',
      );
    }
    if (!col.municipioCodigo && !col.municipio) {
      throw new BadRequestException(
        'Indica la columna del código DANE del municipio o la del nombre del municipio.',
      );
    }
    const leer = (celdas: string[], campo: CampoMapeoPdet) =>
      col[campo] ? (celdas[col[campo]! - 1] ?? '').trim() : '';

    // Catálogos en una consulta cada uno, nada de consultas por fila.
    const [municipios, existentes] = await Promise.all([
      this.municipioRepository.find({ relations: { departamento: true } }),
      this.veredaPdetRepository.find({
        relations: { municipio: true, veredaDane: true },
      }),
    ]);
    const codigosVereda = col.veredaDaneCodigo
      ? [
          ...new Set(
            tabla.filas
              .map((f) => leer(f.celdas, 'veredaDaneCodigo'))
              .filter(Boolean),
          ),
        ]
      : [];
    const veredasDane = codigosVereda.length
      ? await this.veredaRepository.find({
          where: { codigo: In(codigosVereda) },
          relations: { municipio: true },
        })
      : [];

    const porCodigoMunicipio = new Map(municipios.map((m) => [m.codigo, m]));
    const porNombreMunicipio = new Map<string, Municipio[]>();
    for (const m of municipios) {
      const clave = normalizarTitulo(m.nombre);
      porNombreMunicipio.set(clave, [
        ...(porNombreMunicipio.get(clave) ?? []),
        m,
      ]);
    }
    const veredaPorCodigo = new Map(veredasDane.map((v) => [v.codigo, v]));
    const existentePorClave = new Map(
      existentes.map((v) => [`${v.municipio.id}|${v.codigo}`, v]),
    );
    const vistas = new Set<string>();

    return tabla.filas.map(({ numero, celdas }) => {
      const errores: string[] = [];
      const nombre = leer(celdas, 'nombre');
      const subregion = leer(celdas, 'subregion') || null;
      let codigo = leer(celdas, 'codigo');
      if (!nombre) errores.push('Falta el nombre de la vereda');

      let municipio: Municipio | undefined;
      const codMun = codigoMunicipio(leer(celdas, 'municipioCodigo'));
      if (codMun) {
        municipio = porCodigoMunicipio.get(codMun);
        if (!municipio)
          errores.push(`No existe el municipio con código DANE ${codMun}`);
      } else {
        const candidatos =
          porNombreMunicipio.get(normalizarTitulo(leer(celdas, 'municipio'))) ??
          [];
        const depto = normalizarTitulo(leer(celdas, 'departamento'));
        const filtrados = depto
          ? candidatos.filter(
              (m) => normalizarTitulo(m.departamento?.nombre ?? '') === depto,
            )
          : candidatos;
        if (filtrados.length === 1) municipio = filtrados[0];
        else if (filtrados.length > 1) {
          errores.push(
            'Hay varios municipios con ese nombre: agrega la columna de departamento o el código DANE',
          );
        } else {
          errores.push(
            `No se encontró el municipio "${leer(celdas, 'municipio')}"`,
          );
        }
      }

      // Sin código en el archivo: se deriva del nombre para poder actualizar en la siguiente carga.
      if (!codigo && nombre) {
        codigo = normalizarTitulo(nombre)
          .replace(/\s+/g, '_')
          .toUpperCase()
          .slice(0, 60);
      }

      let veredaDane: Vereda | undefined;
      const codVereda = leer(celdas, 'veredaDaneCodigo');
      if (codVereda) {
        veredaDane = veredaPorCodigo.get(codVereda);
        if (!veredaDane) errores.push(`No existe la vereda DANE ${codVereda}`);
        else if (municipio && veredaDane.municipio.id !== municipio.id) {
          errores.push(`La vereda DANE ${codVereda} es de otro municipio`);
        }
      }

      let accion: AccionFilaPdet = 'CREAR';
      if (municipio && codigo) {
        const clave = `${municipio.id}|${codigo}`;
        if (vistas.has(clave))
          errores.push('Código repetido en el archivo para el mismo municipio');
        vistas.add(clave);
        const actual = existentePorClave.get(clave);
        if (actual) {
          const igual =
            actual.nombre === nombre &&
            (actual.subregion ?? null) === subregion &&
            (actual.veredaDane?.id ?? null) === (veredaDane?.id ?? null) &&
            actual.estaActivo;
          accion = igual ? 'SIN_CAMBIOS' : 'ACTUALIZAR';
        }
      }
      if (errores.length) accion = 'ERROR';

      return {
        fila: numero,
        codigo,
        nombre,
        subregion,
        municipio: municipio
          ? {
              id: municipio.id,
              codigo: municipio.codigo,
              nombre: municipio.nombre,
              departamento: municipio.departamento?.nombre ?? '',
            }
          : null,
        veredaDane: veredaDane
          ? {
              id: veredaDane.id,
              codigo: veredaDane.codigo,
              nombre: veredaDane.nombre,
            }
          : null,
        accion,
        errores,
      };
    });
  }

  private validarVeredaDane(
    vereda: Vereda | null,
    municipioId: string,
    solicitada?: string | null,
  ): void {
    if (solicitada && !vereda)
      throw new NotFoundException('Vereda DANE no encontrada');
    if (vereda && vereda.municipio.id !== municipioId) {
      throw new BadRequestException(
        'La vereda DANE equivalente debe ser del mismo municipio.',
      );
    }
  }

  private aRespuesta(v: VeredaPdet) {
    return {
      id: v.id,
      codigo: v.codigo,
      nombre: v.nombre,
      subregion: v.subregion,
      estaActivo: v.estaActivo,
      municipio: v.municipio
        ? {
            id: v.municipio.id,
            codigo: v.municipio.codigo,
            nombre: v.municipio.nombre,
            departamento: v.municipio.departamento
              ? {
                  id: v.municipio.departamento.id,
                  codigo: v.municipio.departamento.codigo,
                  nombre: v.municipio.departamento.nombre,
                }
              : null,
          }
        : null,
      veredaDane: v.veredaDane
        ? {
            id: v.veredaDane.id,
            codigo: v.veredaDane.codigo,
            nombre: v.veredaDane.nombre,
          }
        : null,
    };
  }
}
