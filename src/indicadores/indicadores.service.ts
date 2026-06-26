import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  CrearIndicadorDto,
  RangoFechasIndicadorDto,
  RegistrarValorIndicadorDto,
} from './dto/indicador.dto';
import {
  AvanceIndicadorDto,
  PuntoLineaTiempoDto,
  PuntoTendenciaDto,
  RespuestaIndicadorDto,
  RespuestaRegistroIndicadorDto,
} from './dto/respuesta-indicador.dto';
import { Indicador } from './entities/indicador.entity';
import { RegistroIndicador } from './entities/registro-indicador.entity';
import { TipoIndicador } from './enums/tipo-indicador.enum';
import {
  aAvanceIndicador,
  aLineaTiempo,
  aRespuestaIndicador,
  aRespuestaRegistro,
} from './utils/serializar-indicador';

@Injectable()
export class IndicadoresService {
  constructor(
    @InjectRepository(Indicador)
    private readonly indicadorRepository: Repository<Indicador>,
    @InjectRepository(RegistroIndicador)
    private readonly registroRepository: Repository<RegistroIndicador>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
  ) {}

  async crear(dto: CrearIndicadorDto): Promise<RespuestaIndicadorDto> {
    const proyectos = await this.proyectoRepository.findBy({
      id: In(dto.proyectoIds),
    });

    if (proyectos.length !== dto.proyectoIds.length) {
      throw new NotFoundException('Uno o más proyectos no existen');
    }

    const indicador = this.indicadorRepository.create({
      nombre: dto.nombre,
      unidad: dto.unidad,
      valorMeta: dto.valorMeta,
      tipo: dto.tipo,
      frecuencia: dto.frecuencia,
      proyectos,
    });

    const guardado = await this.indicadorRepository.save(indicador);
    return aRespuestaIndicador(guardado);
  }

  async listar(): Promise<RespuestaIndicadorDto[]> {
    const indicadores = await this.indicadorRepository.find({
      order: { nombre: 'ASC' },
    });
    return indicadores.map((i) => aRespuestaIndicador(i));
  }

  async obtenerUno(id: string): Promise<RespuestaIndicadorDto> {
    const indicador = await this.buscarIndicador(id);
    return aRespuestaIndicador(indicador);
  }

  async registrarValor(
    indicadorId: string,
    dto: RegistrarValorIndicadorDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaRegistroIndicadorDto> {
    const indicador = await this.indicadorRepository.findOne({
      where: { id: indicadorId },
      relations: { proyectos: true },
    });

    if (!indicador) {
      throw new NotFoundException(`Indicador ${indicadorId} no encontrado`);
    }

    const jornada = await this.jornadaRepository.findOne({
      where: { id: dto.jornadaId },
      relations: { proyecto: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${dto.jornadaId} no encontrada`);
    }

    const proyectoIds = indicador.proyectos?.map((p) => p.id) ?? [];

    if (!proyectoIds.includes(jornada.proyecto.id)) {
      throw new BadRequestException(
        'La jornada no pertenece a ningún proyecto asociado al indicador',
      );
    }

    const registro = this.registroRepository.create({
      valor: dto.valor,
      registradoEn: dto.registradoEn ? new Date(dto.registradoEn) : new Date(),
      observaciones: dto.observaciones,
      indicador: { id: indicadorId },
      jornada: { id: dto.jornadaId },
      usuario: { id: usuarioActual.id },
    });

    const guardado = await this.registroRepository.save(registro);
    return aRespuestaRegistro(guardado);
  }

  async obtenerAvance(proyectoId: string): Promise<AvanceIndicadorDto[]> {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }

    const indicadores = await this.indicadorRepository
      .createQueryBuilder('indicador')
      .innerJoin('indicador.proyectos', 'proyecto', 'proyecto.id = :proyectoId', {
        proyectoId,
      })
      .getMany();

    const avances: AvanceIndicadorDto[] = [];

    for (const indicador of indicadores) {
      const registros = await this.registroRepository
        .createQueryBuilder('registro')
        .innerJoin('registro.jornada', 'jornada')
        .where('registro.indicador_id = :indicadorId', {
          indicadorId: indicador.id,
        })
        .andWhere('jornada.proyecto_id = :proyectoId', { proyectoId })
        .orderBy('registro.registrado_en', 'DESC')
        .getMany();

      const valorActual = this.calcularValorActual(indicador.tipo, registros);
      const meta = Number(indicador.valorMeta ?? 0);
      const porcentaje =
        meta > 0 ? Math.min(100, Math.round((valorActual / meta) * 10000) / 100) : 0;

      const tendencia: PuntoTendenciaDto[] = registros
        .slice(0, 5)
        .map((r) => ({
          registradoEn: r.registradoEn,
          valor: Number(r.valor),
        }));

      avances.push(
        aAvanceIndicador({
          indicadorId: indicador.id,
          nombre: indicador.nombre,
          unidad: indicador.unidad,
          valorMeta: meta || undefined,
          valorActual,
          porcentaje,
          tendencia,
        }),
      );
    }

    return avances;
  }

  async obtenerLineaTiempo(
    indicadorId: string,
    rango: RangoFechasIndicadorDto,
  ): Promise<PuntoLineaTiempoDto[]> {
    await this.buscarIndicador(indicadorId);

    const query = this.registroRepository
      .createQueryBuilder('registro')
      .where('registro.indicador_id = :indicadorId', { indicadorId })
      .orderBy('registro.registrado_en', 'ASC');

    if (rango.fechaDesde) {
      query.andWhere('registro.registrado_en >= :fechaDesde', {
        fechaDesde: rango.fechaDesde,
      });
    }

    if (rango.fechaHasta) {
      query.andWhere('registro.registrado_en <= :fechaHasta', {
        fechaHasta: rango.fechaHasta,
      });
    }

    const registros = await query.getMany();

    return aLineaTiempo(
      registros.map((r) => ({
        registradoEn: r.registradoEn,
        valor: Number(r.valor),
        observaciones: r.observaciones,
      })),
    );
  }

  private calcularValorActual(
    tipo: TipoIndicador,
    registros: RegistroIndicador[],
  ): number {
    if (!registros.length) {
      return 0;
    }

    if (tipo === TipoIndicador.CUANTITATIVO) {
      return registros.reduce((suma, r) => suma + Number(r.valor), 0);
    }

    return Number(registros[0].valor);
  }

  private async buscarIndicador(id: string): Promise<Indicador> {
    const indicador = await this.indicadorRepository.findOne({ where: { id } });

    if (!indicador) {
      throw new NotFoundException(`Indicador ${id} no encontrado`);
    }

    return indicador;
  }
}
