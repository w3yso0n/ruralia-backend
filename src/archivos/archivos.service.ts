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
import { ColaEvidenciasService } from '../cola/cola-evidencias.service';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EstadoEvidencia } from '../evidencias/enums/estado-evidencia.enum';
import { Jornada } from '../jornadas/entities/jornada.entity';

export interface RespuestaSubidaArchivoDto {
  archivoId: string;
  estado: 'en_cola';
}

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
  ): Promise<RespuestaSubidaArchivoDto> {
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
