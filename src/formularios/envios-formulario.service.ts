import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ColaEnviosService } from '../cola/cola-envios.service';
import {
  CronologiaService,
  detalleConOrigen,
} from '../cronologia/cronologia.service';
import { JornadasService } from '../jornadas/jornadas.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { EnviarFormularioDto, ActualizarEnvioFormularioDto } from './dto/formulario.dto';
import {
  RespuestaDetalleRespuestaDto,
  RespuestaEnvioFormularioDto,
  RespuestaEnvioPrevioDto,
} from './dto/respuesta-formulario.dto';
import { CampoFormulario } from './entities/campo-formulario.entity';
import { EnvioFormulario } from './entities/envio-formulario.entity';
import { PlantillaFormulario } from './entities/plantilla-formulario.entity';
import { RespuestaFormulario } from './entities/respuesta-formulario.entity';
import { TipoCampo } from './enums/tipo-campo.enum';
import { TipoPlantilla } from './enums/tipo-plantilla.enum';
import {
  aRespuestaDetalle,
  aRespuestaEnvio,
  aRespuestaEnvioPrevio,
} from './utils/serializar-formulario';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { TipoJornada } from '../jornadas/enums/tipo-jornada.enum';

interface RespuestaEntrada {
  claveCampo: string;
  valor: unknown;
}

@Injectable()
export class EnviosFormularioService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PlantillaFormulario)
    private readonly plantillaRepository: Repository<PlantillaFormulario>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
    @InjectRepository(RespuestaFormulario)
    private readonly respuestaRepository: Repository<RespuestaFormulario>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    private readonly jornadasService: JornadasService,
    private readonly colaEnviosService: ColaEnviosService,
    private readonly cronologiaService: CronologiaService,
  ) {}

  async enviar(
    dto: EnviarFormularioDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaEnvioFormularioDto> {
    if (dto.jornadaId) {
      await this.jornadasService.obtenerUna(dto.jornadaId);
    }

    const plantilla = await this.plantillaRepository.findOne({
      where: { id: dto.plantillaFormularioId },
      relations: { campos: true },
    });

    if (!plantilla) {
      throw new NotFoundException(
        `Plantilla ${dto.plantillaFormularioId} no encontrada`,
      );
    }

    if (!plantilla.estaActivo) {
      throw new BadRequestException('La plantilla no está publicada');
    }

    this.validarCamposObligatorios(
      plantilla.campos ?? [],
      dto.respuestas as RespuestaEntrada[],
    );

    const indiceFila = dto.indiceFila ?? 0;

    if (dto.jornadaId) {
      const existente = await this.envioRepository.findOne({
        where: {
          jornada: { id: dto.jornadaId },
          plantillaFormulario: { id: dto.plantillaFormularioId },
          indiceFila,
        },
      });
      if (existente) {
        return this.actualizar(existente.id, { respuestas: dto.respuestas }, usuarioActual);
      }
    }

    const ahora = new Date();

    const envioGuardado = await this.dataSource.transaction(async (manager) => {
      const envio = manager.create(EnvioFormulario, {
        enviadoEn: ahora,
        sincronizadoEn: ahora,
        esOffline: false,
        indiceFila,
        datosRaw: { respuestas: dto.respuestas, usuarioId: usuarioActual.id },
        jornada: dto.jornadaId ? { id: dto.jornadaId } : null,
        usuario: { id: usuarioActual.id },
        plantillaFormulario: { id: dto.plantillaFormularioId },
      });

      const guardado = await manager.save(EnvioFormulario, envio);

      for (const entrada of dto.respuestas) {
        const campo = plantilla.campos?.find(
          (c) => c.clave === entrada.claveCampo,
        );

        if (!campo) {
          continue;
        }

        const respuesta = this.mapearRespuesta(
          manager,
          guardado.id,
          campo,
          entrada.valor,
        );

        await manager.save(RespuestaFormulario, respuesta);
      }

      return guardado;
    });

    if (dto.jornadaId) {
      await this.colaEnviosService.encolarProcesarEnvio({
        envioId: envioGuardado.id,
        jornadaId: dto.jornadaId,
      });

      const jornada = await this.jornadaRepository.findOne({
        where: { id: dto.jornadaId },
        relations: { proyecto: true },
      });

      if (jornada?.proyecto?.id) {
        await this.cronologiaService.registrar({
          actorId: usuarioActual.id,
          proyectoId: jornada.proyecto.id,
          accion: 'FORMULARIO_ENVIADO',
          entidadTipo: 'envio_formulario',
          entidadId: envioGuardado.id,
          contextoTitulo: { nombrePlantilla: plantilla.nombre },
          detalle: detalleConOrigen('api', {
            jornadaId: dto.jornadaId,
            plantillaId: plantilla.id,
          }),
        });
      }
    }

    const envioCompleto = await this.envioRepository.findOne({
      where: { id: envioGuardado.id },
      relations: { jornada: true, usuario: true, plantillaFormulario: true },
    });

    return aRespuestaEnvio(envioCompleto!);
  }

  async listarPorJornada(
    jornadaId: string,
  ): Promise<RespuestaEnvioFormularioDto[]> {
    await this.jornadasService.obtenerUna(jornadaId);

    const envios = await this.envioRepository.find({
      where: { jornada: { id: jornadaId } },
      relations: {
        jornada: true,
        usuario: true,
        plantillaFormulario: true,
      },
      order: { indiceFila: 'ASC', enviadoEn: 'DESC' },
    });

    return envios.map((e) => aRespuestaEnvio(e));
  }

  async eliminar(envioId: string): Promise<void> {
    const envio = await this.envioRepository.findOne({ where: { id: envioId } });
    if (!envio) {
      throw new NotFoundException(`Envío ${envioId} no encontrado`);
    }
    await this.respuestaRepository.delete({ envioFormulario: { id: envioId } });
    await this.envioRepository.delete(envioId);
  }

  async obtenerRespuestas(
    envioId: string,
  ): Promise<RespuestaDetalleRespuestaDto[]> {
    const respuestas = await this.respuestaRepository.find({
      where: { envioFormulario: { id: envioId } },
      relations: { campoFormulario: true },
    });

    if (!respuestas.length) {
      const envio = await this.envioRepository.findOne({
        where: { id: envioId },
      });

      if (!envio) {
        throw new NotFoundException(`Envío ${envioId} no encontrado`);
      }

      return [];
    }

    const detalle = respuestas.map((r) => ({
      id: r.id,
      claveCampo: r.claveCampo,
      etiquetaCampo: r.campoFormulario?.etiqueta ?? r.claveCampo,
      tipoCampo: r.campoFormulario?.tipoCampo,
      valorTexto: r.valorTexto,
      valorNumero: r.valorNumero != null ? Number(r.valorNumero) : undefined,
      valorFecha: r.valorFecha
        ? this.formatearFechaParaCliente(r.valorFecha)
        : undefined,
      valorBooleano: r.valorBooleano,
      valorJson: r.valorJson ?? undefined,
      urlArchivo: r.urlArchivo,
    }));

    return aRespuestaDetalle(detalle);
  }

  async obtenerEnvioPrevio(
    plantillaFormularioId: string,
    usuario: Usuario,
    jornadaId?: string,
  ): Promise<RespuestaEnvioPrevioDto> {
    const plantilla = await this.plantillaRepository.findOne({
      where: { id: plantillaFormularioId },
    });

    if (!plantilla) {
      throw new NotFoundException(
        `Plantilla ${plantillaFormularioId} no encontrada`,
      );
    }

    if (jornadaId) {
      await this.jornadasService.obtenerUna(jornadaId);
    }

    const qb = this.envioRepository
      .createQueryBuilder('envio')
      .leftJoinAndSelect('envio.jornada', 'jornada')
      .leftJoinAndSelect('envio.usuario', 'usuario')
      .leftJoinAndSelect('envio.plantillaFormulario', 'plantillaFormulario')
      .where('envio.plantilla_formulario_id = :plantillaId', {
        plantillaId: plantillaFormularioId,
      });

    if (jornadaId) {
      qb.andWhere('envio.jornada_id = :jornadaId', { jornadaId });
    } else {
      qb.andWhere('envio.jornada_id IS NULL').andWhere(
        'envio.usuario_id = :usuarioId',
        { usuarioId: usuario.id },
      );
    }

    const envio = await qb.orderBy('envio.enviado_en', 'DESC').getOne();

    if (!envio) {
      return aRespuestaEnvioPrevio(null, []);
    }

    const respuestas = await this.obtenerRespuestas(envio.id);
    return aRespuestaEnvioPrevio(aRespuestaEnvio(envio), respuestas);
  }

  async actualizar(
    envioId: string,
    dto: ActualizarEnvioFormularioDto,
    usuarioActual: Usuario,
  ): Promise<RespuestaEnvioFormularioDto> {
    const envio = await this.envioRepository.findOne({
      where: { id: envioId },
      relations: {
        plantillaFormulario: { campos: true },
        jornada: true,
        usuario: true,
      },
    });

    if (!envio) {
      throw new NotFoundException(`Envío ${envioId} no encontrado`);
    }

    const plantilla = envio.plantillaFormulario;

    if (!plantilla) {
      throw new NotFoundException('Plantilla del envío no encontrada');
    }

    this.validarCamposObligatorios(
      plantilla.campos ?? [],
      dto.respuestas as RespuestaEntrada[],
    );

    const ahora = new Date();

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RespuestaFormulario, {
        envioFormulario: { id: envioId },
      });

      for (const entrada of dto.respuestas) {
        const campo = plantilla.campos?.find(
          (c) => c.clave === entrada.claveCampo,
        );

        if (!campo) {
          continue;
        }

        const respuesta = this.mapearRespuesta(
          manager,
          envioId,
          campo,
          entrada.valor,
        );

        await manager.save(RespuestaFormulario, respuesta);
      }

      await manager.update(EnvioFormulario, envioId, {
        enviadoEn: ahora,
        sincronizadoEn: ahora,
        datosRaw: {
          respuestas: dto.respuestas,
          usuarioId: usuarioActual.id,
          actualizadoPor: usuarioActual.id,
        },
      });
    });

    if (envio.jornada?.id) {
      await this.colaEnviosService.encolarProcesarEnvio({
        envioId,
        jornadaId: envio.jornada.id,
      });
    }

    const actualizado = await this.envioRepository.findOne({
      where: { id: envioId },
      relations: { jornada: true, usuario: true, plantillaFormulario: true },
    });

    return aRespuestaEnvio(actualizado!);
  }

  private formatearFechaParaCliente(valor: Date): string {
    const y = valor.getUTCFullYear();
    const m = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const d = String(valor.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parsearFechaCampo(valor: unknown): Date {
    const texto = String(valor).slice(0, 10);
    const [anio, mes, dia] = texto.split('-').map(Number);

    if (!anio || !mes || !dia) {
      return new Date(String(valor));
    }

    return new Date(Date.UTC(anio, mes - 1, dia));
  }

  private normalizarValorTabla(valor: unknown): {
    filas: Record<string, unknown>[];
  } {
    if (valor == null || typeof valor !== 'object') {
      throw new BadRequestException(
        'El valor de un campo TABLA debe ser un objeto { filas: [...] }',
      );
    }

    const bruto = valor as { filas?: unknown };
    if (!Array.isArray(bruto.filas)) {
      throw new BadRequestException(
        'El valor de un campo TABLA debe incluir filas como arreglo',
      );
    }

    const filas: Record<string, unknown>[] = [];
    for (const fila of bruto.filas) {
      if (fila == null || typeof fila !== 'object' || Array.isArray(fila)) {
        throw new BadRequestException(
          'Cada fila de un campo TABLA debe ser un objeto',
        );
      }
      filas.push(fila as Record<string, unknown>);
    }

    return { filas };
  }

  private validarCamposObligatorios(
    campos: CampoFormulario[],
    respuestas: RespuestaEntrada[],
  ): void {
    const mapaRespuestas = new Map(
      respuestas.map((r) => [r.claveCampo, r.valor]),
    );

    for (const campo of campos.filter((c) => c.esObligatorio)) {
      const valor = mapaRespuestas.get(campo.clave);

      if (campo.tipoCampo === TipoCampo.TABLA) {
        if (valor === undefined || valor === null) {
          throw new BadRequestException(
            `El campo obligatorio "${campo.etiqueta}" (${campo.clave}) no fue completado`,
          );
        }
        const tabla = this.normalizarValorTabla(valor);
        if (tabla.filas.length === 0) {
          throw new BadRequestException(
            `El campo obligatorio "${campo.etiqueta}" (${campo.clave}) requiere al menos una fila`,
          );
        }
        continue;
      }

      if (valor === undefined || valor === null || valor === '') {
        throw new BadRequestException(
          `El campo obligatorio "${campo.etiqueta}" (${campo.clave}) no fue completado`,
        );
      }
    }
  }

  private mapearRespuesta(
    manager: EntityManager,
    envioId: string,
    campo: CampoFormulario,
    valor: unknown,
  ): RespuestaFormulario {
    const base = {
      claveCampo: campo.clave,
      envioFormulario: { id: envioId },
      campoFormulario: { id: campo.id },
    };

    switch (campo.tipoCampo) {
      case TipoCampo.NUMERO:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorNumero: Number(valor),
        });
      case TipoCampo.FECHA:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorFecha: this.parsearFechaCampo(valor),
        });
      case TipoCampo.SI_NO:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorBooleano: Boolean(valor),
        });
      case TipoCampo.TABLA:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorJson:
            valor == null
              ? { filas: [] }
              : this.normalizarValorTabla(valor),
        });
      case TipoCampo.GPS:
      case TipoCampo.SELECCION_MULTIPLE:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorJson:
            typeof valor === 'object'
              ? (valor as Record<string, unknown>)
              : { valor },
        });
      case TipoCampo.FOTO:
      case TipoCampo.FIRMA:
      case TipoCampo.ARCHIVO:
        return manager.create(RespuestaFormulario, {
          ...base,
          urlArchivo: String(valor),
        });
      default:
        return manager.create(RespuestaFormulario, {
          ...base,
          valorTexto: String(valor),
        });
    }
  }
}
