import { Processor, Process } from '@nestjs/bull';
import {
  GenerarMiniaturaJob,
  NOMBRE_COLA_EVIDENCIAS,
  ProcesarEvidenciaJob,
} from '../cola/cola.constants';
import { ColaEvidenciasService } from '../cola/cola-evidencias.service';
import { EvidenciaProcesamientoService } from './evidencia-procesamiento.service';

@Processor(NOMBRE_COLA_EVIDENCIAS)
export class ProcesadorEvidencia {
  constructor(
    private readonly evidenciaProcesamientoService: EvidenciaProcesamientoService,
    private readonly colaEvidenciasService: ColaEvidenciasService,
  ) {}

  @Process('procesar-evidencia')
  async procesarEvidencia(job: {
    data: ProcesarEvidenciaJob;
  }): Promise<void> {
    await this.evidenciaProcesamientoService.procesarEvidencia(job.data);

    if (job.data.tipoMime?.startsWith('image/')) {
      await this.colaEvidenciasService.encolarGenerarMiniatura({
        evidenciaId: job.data.evidenciaId,
        rutaArchivo: job.data.rutaArchivo,
        urlRelativa: job.data.urlRelativa,
      });
    }
  }

  @Process('generar-miniatura')
  async generarMiniatura(job: {
    data: GenerarMiniaturaJob;
  }): Promise<void> {
    await this.evidenciaProcesamientoService.generarMiniatura(job.data);
  }
}
