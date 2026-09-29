import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vereda } from '../territorios/entities/vereda.entity';
import {
  ActualizarBeneficiarioDto,
  CrearBeneficiarioDto,
  EstadoFiltroBeneficiario,
  FiltrosBeneficiarioDto,
} from './dto/beneficiario.dto';
import {
  RespuestaBeneficiarioDto,
  RespuestaPaginadaBeneficiariosDto,
  RespuestaUsoBeneficiarioDto,
} from './dto/respuesta-beneficiario.dto';
import { Beneficiario } from './entities/beneficiario.entity';
import {
  normalizarIdentificador,
  parsearExcelBeneficiarios,
} from '../proyectos/utils/excel-beneficiarios';
import { RespuestaCargaMasivaBeneficiariosDto } from '../proyectos/dto/carga-beneficiarios.dto';
import {
  aRespuestaBeneficiario,
  aRespuestaPaginadaBeneficiarios,
} from './utils/serializar-beneficiario';
import { MENSAJE_DOCUMENTO_ELIMINADO } from './utils/mensajes-beneficiario';

@Injectable()
export class BeneficiariosService {
  constructor(
    @InjectRepository(Beneficiario)
    private readonly beneficiarioRepository: Repository<Beneficiario>,
    @InjectRepository(Vereda)
    private readonly veredaRepository: Repository<Vereda>,
  ) {}

  async listar(
    filtros: FiltrosBeneficiarioDto,
  ): Promise<RespuestaPaginadaBeneficiariosDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 20;
    const skip = (pagina - 1) * limite;

    const query = this.beneficiarioRepository
      .createQueryBuilder('beneficiario')
      .leftJoinAndSelect('beneficiario.vereda', 'vereda')
      .where('beneficiario.eliminadoEn IS NULL')
      .andWhere('beneficiario.estaActivo = :activo', {
        activo: filtros.estado !== EstadoFiltroBeneficiario.DESACTIVADOS,
      })
      .orderBy('beneficiario.apellidos', 'ASC');

    if (filtros.veredaId) {
      query.andWhere('vereda.id = :veredaId', { veredaId: filtros.veredaId });
    }

    if (filtros.busqueda) {
      query.andWhere(
        '(beneficiario.nombres ILIKE :busqueda OR beneficiario.apellidos ILIKE :busqueda OR beneficiario.numeroDocumento ILIKE :busqueda)',
        { busqueda: `%${filtros.busqueda}%` },
      );
    }

    const [beneficiarios, total] = await query
      .skip(skip)
      .take(limite)
      .getManyAndCount();

    const datos = beneficiarios.map(aRespuestaBeneficiario);
    return aRespuestaPaginadaBeneficiarios(datos, total, pagina, limite);
  }

  async obtenerUno(id: string): Promise<RespuestaBeneficiarioDto> {
    const beneficiario = await this.beneficiarioRepository.findOne({
      where: { id },
      relations: { vereda: true },
    });

    if (!beneficiario || beneficiario.eliminadoEn) {
      throw new NotFoundException(`Beneficiario ${id} no encontrado`);
    }

    return aRespuestaBeneficiario(beneficiario);
  }

  /** Dónde se usa el beneficiario; alimenta las advertencias antes de eliminarlo. */
  async obtenerUso(id: string): Promise<RespuestaUsoBeneficiarioDto> {
    await this.buscarNoEliminado(id);
    const contar = async (sql: string) => {
      const [fila] = await this.beneficiarioRepository.query<
        { total: string }[]
      >(sql, [id]);
      return Number(fila?.total ?? 0);
    };
    const [proyectos, jornadas, asociaciones, documentos] = await Promise.all([
      contar(
        'SELECT COUNT(DISTINCT proyecto_id) AS total FROM proyecto_beneficiarios WHERE beneficiario_id = $1',
      ),
      contar(
        'SELECT COUNT(*) AS total FROM jornada_beneficiarios WHERE beneficiario_id = $1',
      ),
      contar(
        'SELECT COUNT(*) AS total FROM asociacion_beneficiarios WHERE beneficiario_id = $1',
      ),
      contar(
        'SELECT COUNT(*) AS total FROM documentos_externos WHERE beneficiario_id = $1',
      ),
    ]);
    return { proyectos, jornadas, asociaciones, documentos };
  }

  async importarExcel(
    archivo: Express.Multer.File,
    veredaId: string,
  ): Promise<RespuestaCargaMasivaBeneficiariosDto> {
    if (!veredaId) {
      throw new BadRequestException(
        'Elige la vereda de las personas nuevas antes de cargar el archivo',
      );
    }
    await this.verificarVereda(veredaId);
    const vereda = await this.veredaRepository.findOne({
      where: { id: veredaId },
    });
    if (!vereda || !/^[0-9]+$/.test(vereda.codigo)) {
      throw new BadRequestException(
        'La vereda debe ser del catálogo DANE',
      );
    }

    const filas = await parsearExcelBeneficiarios(archivo.buffer);
    const detalle: RespuestaCargaMasivaBeneficiariosDto['detalle'] = [];
    const vistos = new Set<string>();
    let creados = 0;
    let asignadosExistentes = 0;
    let errores = 0;

    for (const fila of filas) {
      if (!fila.identificador || !fila.nombres) {
        errores += 1;
        detalle.push({
          fila: fila.fila,
          identificador: fila.identificador,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          resultado: 'error',
          mensaje: 'Faltan nombre e identificador',
        });
        continue;
      }
      if (vistos.has(fila.identificador)) {
        errores += 1;
        detalle.push({
          fila: fila.fila,
          identificador: fila.identificador,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          resultado: 'error',
          mensaje: 'Identificador duplicado en el archivo',
        });
        continue;
      }
      vistos.add(fila.identificador);

      const existente = await this.buscarPorDocumento(fila.identificador);
      if (existente?.eliminadoEn) {
        errores += 1;
        detalle.push({
          fila: fila.fila,
          identificador: fila.identificador,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          resultado: 'error',
          mensaje: MENSAJE_DOCUMENTO_ELIMINADO,
        });
        continue;
      }
      if (existente && existente.estaActivo) {
        asignadosExistentes += 1;
        detalle.push({
          fila: fila.fila,
          identificador: fila.identificador,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          resultado: 'asignado_existente',
          beneficiarioId: existente.id,
          mensaje: 'Ya estaba activo en el catálogo',
        });
        continue;
      }

      if (existente) {
        existente.estaActivo = true;
        existente.nombres = fila.nombres.trim();
        existente.apellidos = fila.apellidos.trim() || fila.nombres.trim();
        existente.tipoDocumento = fila.tipoDocumento;
        existente.telefono = fila.telefono || existente.telefono;
        existente.correo = fila.correo || existente.correo;
        existente.vereda = { id: veredaId } as Beneficiario['vereda'];
        const reactivado = await this.beneficiarioRepository.save(existente);
        creados += 1;
        detalle.push({
          fila: fila.fila,
          identificador: fila.identificador,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
          resultado: 'creado',
          beneficiarioId: reactivado.id,
          mensaje: 'Se reactivó',
        });
        continue;
      }

      const creado = await this.beneficiarioRepository.save(
        this.beneficiarioRepository.create({
          nombres: fila.nombres.trim(),
          apellidos: fila.apellidos.trim() || fila.nombres.trim(),
          numeroDocumento: fila.identificador,
          tipoDocumento: fila.tipoDocumento,
          telefono: fila.telefono || undefined,
          correo: fila.correo || undefined,
          vereda: { id: veredaId },
          estaActivo: true,
        }),
      );
      creados += 1;
      detalle.push({
        fila: fila.fila,
        identificador: fila.identificador,
        nombres: fila.nombres,
        apellidos: fila.apellidos,
        resultado: 'creado',
        beneficiarioId: creado.id,
      });
    }

    return {
      totalFilas: filas.length,
      creados,
      asignadosExistentes,
      yaEnProyecto: 0,
      errores,
      detalle,
    };
  }

  private async buscarPorDocumento(
    numeroDocumento: string,
  ): Promise<Beneficiario | null> {
    const identificador = normalizarIdentificador(numeroDocumento);
    return this.beneficiarioRepository
      .createQueryBuilder('b')
      .where(
        `REPLACE(REPLACE(REPLACE(UPPER(b.numero_documento), '.', ''), '-', ''), ' ', '') = :id`,
        { id: identificador },
      )
      .getOne();
  }

  async crear(dto: CrearBeneficiarioDto): Promise<RespuestaBeneficiarioDto> {
    await this.verificarDocumentoUnico(dto.numeroDocumento);
    await this.verificarVereda(dto.veredaId);

    const beneficiario = this.beneficiarioRepository.create({
      nombres: dto.nombres,
      apellidos: dto.apellidos,
      tipoDocumento: dto.tipoDocumento,
      numeroDocumento: dto.numeroDocumento,
      telefono: dto.telefono,
      correo: dto.correo,
      genero: dto.genero,
      fechaNacimiento: dto.fechaNacimiento
        ? new Date(dto.fechaNacimiento)
        : undefined,
      vereda: { id: dto.veredaId },
    });

    const guardado = await this.beneficiarioRepository.save(beneficiario);
    return this.obtenerUno(guardado.id);
  }

  async actualizar(
    id: string,
    dto: ActualizarBeneficiarioDto,
  ): Promise<RespuestaBeneficiarioDto> {
    const beneficiario = await this.buscarNoEliminado(id);

    if (
      dto.numeroDocumento &&
      dto.numeroDocumento !== beneficiario.numeroDocumento
    ) {
      await this.verificarDocumentoUnico(dto.numeroDocumento, id);
    }

    if (dto.veredaId) {
      await this.verificarVereda(dto.veredaId);
      beneficiario.vereda = { id: dto.veredaId } as Vereda;
    }

    if (dto.nombres !== undefined) beneficiario.nombres = dto.nombres;
    if (dto.apellidos !== undefined) beneficiario.apellidos = dto.apellidos;
    if (dto.tipoDocumento !== undefined) {
      beneficiario.tipoDocumento = dto.tipoDocumento;
    }
    if (dto.numeroDocumento !== undefined) {
      beneficiario.numeroDocumento = dto.numeroDocumento;
    }
    if (dto.telefono !== undefined) beneficiario.telefono = dto.telefono;
    if (dto.correo !== undefined) beneficiario.correo = dto.correo;
    if (dto.genero !== undefined) beneficiario.genero = dto.genero;
    if (dto.fechaNacimiento !== undefined) {
      beneficiario.fechaNacimiento = new Date(dto.fechaNacimiento);
    }

    await this.beneficiarioRepository.save(beneficiario);
    return this.obtenerUno(id);
  }

  /** Reversible: deja de aparecer en listados y selectores, pero se puede reactivar. */
  async desactivar(id: string): Promise<RespuestaBeneficiarioDto> {
    const beneficiario = await this.buscarNoEliminado(id);
    beneficiario.estaActivo = false;
    await this.beneficiarioRepository.save(beneficiario);
    return this.obtenerUno(id);
  }

  async reactivar(id: string): Promise<RespuestaBeneficiarioDto> {
    const beneficiario = await this.buscarNoEliminado(id);
    beneficiario.estaActivo = true;
    await this.beneficiarioRepository.save(beneficiario);
    return this.obtenerUno(id);
  }

  /**
   * No reversible. Se quita de las asociaciones y deja de existir en la plataforma;
   * el historial de proyectos, jornadas y documentos conserva la referencia.
   */
  async eliminar(id: string): Promise<void> {
    const beneficiario = await this.buscarNoEliminado(id);
    await this.beneficiarioRepository.manager.transaction(async (manager) => {
      await manager.query(
        'DELETE FROM asociacion_beneficiarios WHERE beneficiario_id = $1',
        [id],
      );
      beneficiario.estaActivo = false;
      beneficiario.eliminadoEn = new Date();
      await manager.save(beneficiario);
    });
  }

  private async buscarNoEliminado(id: string): Promise<Beneficiario> {
    const beneficiario = await this.beneficiarioRepository.findOne({
      where: { id },
    });
    if (!beneficiario || beneficiario.eliminadoEn) {
      throw new NotFoundException(`Beneficiario ${id} no encontrado`);
    }
    return beneficiario;
  }

  private async verificarDocumentoUnico(
    numeroDocumento: string,
    excluirId?: string,
  ): Promise<void> {
    const query = this.beneficiarioRepository
      .createQueryBuilder('beneficiario')
      .where('beneficiario.numeroDocumento = :numeroDocumento', {
        numeroDocumento,
      });

    if (excluirId) {
      query.andWhere('beneficiario.id != :excluirId', { excluirId });
    }

    const existente = await query.getOne();

    if (existente?.eliminadoEn) {
      throw new ConflictException(MENSAJE_DOCUMENTO_ELIMINADO);
    }
    if (existente && !existente.estaActivo) {
      throw new ConflictException(
        `Ya existe un beneficiario desactivado con documento ${numeroDocumento}. Reactívalo desde la pestaña Desactivados.`,
      );
    }
    if (existente) {
      throw new ConflictException(
        `Ya existe un beneficiario con documento ${numeroDocumento}`,
      );
    }
  }

  private async verificarVereda(veredaId: string): Promise<void> {
    const existe = await this.veredaRepository.existsBy({ id: veredaId });

    if (!existe) {
      throw new NotFoundException(`Vereda ${veredaId} no encontrada`);
    }
  }
}
