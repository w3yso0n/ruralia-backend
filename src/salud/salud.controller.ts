import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Publica } from '../autenticacion/decorators/publica.decorator';
import { RedisSaludIndicator } from './redis-salud.indicator';

@ApiTags('Salud')
@Controller('salud')
export class SaludController {
  constructor(
    private readonly salud: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisSaludIndicator,
  ) {}

  @Publica()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Verificar estado de base de datos y Redis' })
  @ApiResponse({ status: 200, description: 'Servicios saludables' })
  @ApiResponse({ status: 503, description: 'Algún servicio no disponible' })
  verificar() {
    return this.salud.check([
      () => this.db.pingCheck('base_datos'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
