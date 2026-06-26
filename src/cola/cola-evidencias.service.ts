import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Inject } from '@nestjs/common';
import { EvidenciaProcesamientoService } from '../archivos/evidencia-procesamiento.service';
import {
  GenerarMiniaturaJob,
  NOMBRE_COLA_EVIDENCIAS,
  ProcesarEvidenciaJob,
  REDIS_DISPONIBLE,
} from './cola.constants';

@Injectable()
export class ColaEvidenciasService {
  private readonly logger = new Logger(ColaEvidenciasService.name);

  constructor(
    @Inject(REDIS_DISPONIBLE) private readonly redisDisponible: boolean,
    @Optional()
    @InjectQueue(NOMBRE_COLA_EVIDENCIAS)
    private readonly cola: Queue | undefined,
    private readonly evidenciaProcesamientoService: EvidenciaProcesamientoService,
  ) {}

  async encolarProcesarEvidencia(
    datos: ProcesarEvidenciaJob,
  ): Promise<void> {
    if (!this.redisDisponible || !this.cola) {
      this.logger.warn(
        'Redis no disponible. Procesando evidencia de forma síncrona.',
      );
      await this.evidenciaProcesamientoService.procesarEvidencia(datos);
      if (this.esImagen(datos.tipoMime)) {
        await this.evidenciaProcesamientoService.generarMiniatura({
          evidenciaId: datos.evidenciaId,
          rutaArchivo: datos.rutaArchivo,
          urlRelativa: datos.urlRelativa,
        });
      }
      return;
    }

    await this.cola.add('procesar-evidencia', datos);
  }

  async encolarGenerarMiniatura(datos: GenerarMiniaturaJob): Promise<void> {
    if (!this.redisDisponible || !this.cola) {
      this.logger.warn(
        'Redis no disponible. Generando miniatura de forma síncrona.',
      );
      await this.evidenciaProcesamientoService.generarMiniatura(datos);
      return;
    }

    await this.cola.add('generar-miniatura', datos);
  }

  private esImagen(tipoMime?: string): boolean {
    return !!tipoMime?.startsWith('image/');
  }
}
