import { Processor, Process } from '@nestjs/bull';
import { NOMBRE_COLA_ENVIOS, ProcesarEnvioJob } from '../cola/cola-envios.constants';
import { EnvioProcesamientoService } from './envio-procesamiento.service';

@Processor(NOMBRE_COLA_ENVIOS)
export class ProcesadorEnvios {
  constructor(
    private readonly envioProcesamientoService: EnvioProcesamientoService,
  ) {}

  @Process('procesar-envio')
  async procesarEnvio(job: { data: ProcesarEnvioJob }): Promise<void> {
    await this.envioProcesamientoService.procesarEnvio(job.data);
  }
}
