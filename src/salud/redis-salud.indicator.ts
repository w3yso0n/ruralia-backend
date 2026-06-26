import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { probarConexionRedis } from '../cola/utils/probar-redis';

@Injectable()
export class RedisSaludIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(clave: string): Promise<HealthIndicatorResult> {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const disponible = await probarConexionRedis(host, port);

    return this.getStatus(clave, true, {
      conectado: disponible,
      mensaje: disponible
        ? 'Redis disponible'
        : 'Redis no disponible (modo degradado)',
    });
  }
}
