import { Injectable, Logger, Optional } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EnvioProcesamientoService } from '../formularios/envio-procesamiento.service';
import {
  NOMBRE_COLA_ENVIOS,
  ProcesarEnvioJob,
} from './cola-envios.constants';
import { REDIS_DISPONIBLE } from './cola.constants';

@Injectable()
export class ColaEnviosService {
  private readonly logger = new Logger(ColaEnviosService.name);

  constructor(
    @Inject(REDIS_DISPONIBLE) private readonly redisDisponible: boolean,
    @Optional()
    @InjectQueue(NOMBRE_COLA_ENVIOS)
    private readonly cola: Queue | undefined,
    private readonly envioProcesamientoService: EnvioProcesamientoService,
  ) {}

  async encolarProcesarEnvio(datos: ProcesarEnvioJob): Promise<void> {
    if (!this.redisDisponible || !this.cola) {
      this.logger.warn(
        'Redis no disponible. Procesando envío de formulario de forma síncrona.',
      );
      await this.envioProcesamientoService.procesarEnvio(datos);
      return;
    }

    await this.cola.add('procesar-envio', datos, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 5000 },
    });
  }
}
