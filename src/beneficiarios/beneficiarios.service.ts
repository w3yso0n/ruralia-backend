import {
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
  FiltrosBeneficiarioDto,
} from './dto/beneficiario.dto';
import {
  RespuestaBeneficiarioDto,
  RespuestaPaginadaBeneficiariosDto,
} from './dto/respuesta-beneficiario.dto';
import { Beneficiario } from './entities/beneficiario.entity';
import {
  aRespuestaBeneficiario,
  aRespuestaPaginadaBeneficiarios,
} from './utils/serializar-beneficiario';

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
      .where('beneficiario.estaActivo = true')
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

    if (!beneficiario) {
      throw new NotFoundException(`Beneficiario ${id} no encontrado`);
    }

    return aRespuestaBeneficiario(beneficiario);
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
    const beneficiario = await this.beneficiarioRepository.findOne({
      where: { id },
    });

    if (!beneficiario) {
      throw new NotFoundException(`Beneficiario ${id} no encontrado`);
    }

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

  async eliminar(id: string): Promise<void> {
    const beneficiario = await this.beneficiarioRepository.findOne({
      where: { id },
    });

    if (!beneficiario) {
      throw new NotFoundException(`Beneficiario ${id} no encontrado`);
    }

    beneficiario.estaActivo = false;
    await this.beneficiarioRepository.save(beneficiario);
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
