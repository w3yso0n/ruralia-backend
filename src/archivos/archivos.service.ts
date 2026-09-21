import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { EstadoFuncional } from '../common/workflow/estado-funcional.enum';
import { ColaEvidenciasService } from '../cola/cola-evidencias.service';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EstadoEvidencia } from '../evidencias/enums/estado-evidencia.enum';
import { TipoEvidencia } from '../evidencias/enums/tipo-evidencia.enum';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { RespuestaSubirEvidenciaDto } from './dto/respuesta-subir-evidencia.dto';

@Injectable()
export class ArchivosService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    private readonly colaEvidenciasService: ColaEvidenciasService,
  ) {}

  async subirEvidencia(
    archivo: Express.Multer.File,
    evidenciaId: string,
    jornadaId: string,
  ): Promise<RespuestaSubirEvidenciaDto> {
    const evidencia = await this.evidenciaRepository.findOne({
      where: { id: evidenciaId },
      relations: { jornada: true },
    });

    if (!evidencia) {
      throw new NotFoundException(`Evidencia ${evidenciaId} no encontrada`);
    }

    if (evidencia.jornada.id !== jornadaId) {
      throw new BadRequestException(
        'La evidencia no pertenece a la jornada indicada',
      );
    }

    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId },
      relations: { proyecto: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }

    const proyectoId = jornada.proyecto.id;
    const rutaBase =
      this.configService.get<string>('RUTA_SUBIDAS') ||
      path.join(process.cwd(), 'subidas');
    const directorio = path.join(rutaBase, proyectoId, jornadaId);
    await fs.mkdir(directorio, { recursive: true });

    const extension = path.extname(archivo.originalname) || this.extensionDesdeMime(archivo.mimetype);
    const nombreArchivo = `${randomUUID()}${extension}`;
    const rutaCompleta = path.join(directorio, nombreArchivo);
    const urlRelativa = path
      .join('subidas', proyectoId, jornadaId, nombreArchivo)
      .replace(/\\/g, '/');

    await fs.writeFile(rutaCompleta, archivo.buffer);

    evidencia.estado = EstadoEvidencia.EN_COLA;
    evidencia.nombreArchivo = archivo.originalname;
    evidencia.tipoMime = archivo.mimetype;
    await this.evidenciaRepository.save(evidencia);

    await this.colaEvidenciasService.encolarProcesarEvidencia({
      evidenciaId,
      rutaArchivo: rutaCompleta,
      urlRelativa,
      tipoMime: archivo.mimetype,
    });

    return { archivoId: evidenciaId, estado: 'en_cola' };
  }

  async subirEvidenciaDeJornada(
    archivo: Express.Multer.File,
    jornadaId: string,
    tipo?: TipoEvidencia,
  ) {
    const jornada = await this.jornadaRepository.findOne({
      where: { id: jornadaId },
      relations: { proyecto: true },
    });

    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }

    if (
      jornada.estadoFuncional === EstadoFuncional.APROBADO ||
      jornada.estadoFuncional === EstadoFuncional.EN_REVISION
    ) {
      throw new BadRequestException(
        'Esta jornada no admite nuevas evidencias en su estado actual',
      );
    }

    const evidencia = await this.evidenciaRepository.save(
      this.evidenciaRepository.create({
        tipo: tipo ?? this.tipoDesdeMime(archivo.mimetype),
        estado: EstadoEvidencia.PENDIENTE_ARCHIVO,
        estadoFuncional: EstadoFuncional.CAPTURADO,
        nombreArchivo: archivo.originalname || 'evidencia',
        tipoMime: archivo.mimetype || 'application/octet-stream',
        capturadoEn: new Date(),
        esOffline: false,
        jornada: { id: jornadaId } as Jornada,
      }),
    );

    await this.subirEvidencia(archivo, evidencia.id, jornadaId);

    const actual = await this.evidenciaRepository.findOne({
      where: { id: evidencia.id },
    });

    return {
      id: actual?.id ?? evidencia.id,
      tipo: actual?.tipo ?? evidencia.tipo,
      nombreArchivo: actual?.nombreArchivo ?? evidencia.nombreArchivo,
      urlArchivo: actual?.urlArchivo ?? null,
      urlMiniatura: actual?.urlMiniatura ?? null,
      tipoMime: actual?.tipoMime ?? evidencia.tipoMime,
      capturadoEn: actual?.capturadoEn ?? evidencia.capturadoEn,
      estado: actual?.estado ?? evidencia.estado,
    };
  }

  private tipoDesdeMime(mime: string): TipoEvidencia {
    if (mime.startsWith('image/')) return TipoEvidencia.FOTO;
    if (mime.startsWith('video/')) return TipoEvidencia.VIDEO;
    return TipoEvidencia.DOCUMENTO;
  }

  private extensionDesdeMime(mime: string): string {
    const mapa: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'application/pdf': '.pdf',
      'video/mp4': '.mp4',
    };
    return mapa[mime] ?? '';
  }
}
