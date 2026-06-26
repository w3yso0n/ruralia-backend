import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EstadoEvidencia } from '../evidencias/enums/estado-evidencia.enum';
import {
  GenerarMiniaturaJob,
  ProcesarEvidenciaJob,
} from '../cola/cola.constants';

@Injectable()
export class EvidenciaProcesamientoService {
  private readonly logger = new Logger(EvidenciaProcesamientoService.name);

  constructor(
    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
  ) {}

  async procesarEvidencia(datos: ProcesarEvidenciaJob): Promise<void> {
    const evidencia = await this.evidenciaRepository.findOne({
      where: { id: datos.evidenciaId },
    });

    if (!evidencia) {
      throw new NotFoundException(
        `Evidencia ${datos.evidenciaId} no encontrada para procesar`,
      );
    }

    const stats = await fs.stat(datos.rutaArchivo);

    evidencia.urlArchivo = datos.urlRelativa;
    evidencia.tamanoArchivo = stats.size;
    evidencia.estado = EstadoEvidencia.SINCRONIZADA;
    evidencia.sincronizadoEn = new Date();

    await this.evidenciaRepository.save(evidencia);
  }

  async generarMiniatura(datos: GenerarMiniaturaJob): Promise<void> {
    const evidencia = await this.evidenciaRepository.findOne({
      where: { id: datos.evidenciaId },
    });

    if (!evidencia) {
      return;
    }

    try {
      const sharp = await import('sharp');
      const directorio = path.dirname(datos.rutaArchivo);
      const extension = path.extname(datos.rutaArchivo);
      const nombreMiniatura = `${path.basename(datos.rutaArchivo, extension)}_thumb${extension}`;
      const rutaMiniatura = path.join(directorio, nombreMiniatura);

      await sharp
        .default(datos.rutaArchivo)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .toFile(rutaMiniatura);

      const urlMiniatura = datos.urlRelativa.replace(
        path.basename(datos.urlRelativa),
        nombreMiniatura,
      );

      evidencia.urlMiniatura = urlMiniatura;
      await this.evidenciaRepository.save(evidencia);
    } catch (error) {
      this.logger.warn(
        `No se pudo generar miniatura para evidencia ${datos.evidenciaId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
