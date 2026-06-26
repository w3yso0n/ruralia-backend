import { DynamicModule, Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcesadorEvidencia } from '../archivos/procesador-evidencia.processor';
import { EvidenciaProcesamientoService } from '../archivos/evidencia-procesamiento.service';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { CampoFormulario } from '../formularios/entities/campo-formulario.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { EnvioProcesamientoService } from '../formularios/envio-procesamiento.service';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { ProcesadorEnvios } from '../formularios/procesador-envios.processor';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { ColaEnviosService } from './cola-envios.service';
import { NOMBRE_COLA_ENVIOS } from './cola-envios.constants';
import { ColaEvidenciasService } from './cola-evidencias.service';
import {
  NOMBRE_COLA_EVIDENCIAS,
  REDIS_DISPONIBLE,
} from './cola.constants';
import { probarConexionRedis } from './utils/probar-redis';

const entidadesEnvios = [
  Jornada,
  PlantillaFormulario,
  CampoFormulario,
  EnvioFormulario,
  RespuestaFormulario,
];

@Module({})
export class ColaModule {
  static async forRoot(): Promise<DynamicModule> {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = Number(process.env.REDIS_PORT) || 6379;
    const redisDisponible = await probarConexionRedis(host, port);

    const baseProviders = [
      { provide: REDIS_DISPONIBLE, useValue: redisDisponible },
      EvidenciaProcesamientoService,
      ColaEvidenciasService,
      EnvioProcesamientoService,
      ColaEnviosService,
    ];

    const baseImports = [
      TypeOrmModule.forFeature([Evidencia, ...entidadesEnvios]),
    ];

    if (!redisDisponible) {
      Logger.warn(
        'Redis no disponible. Las colas Bull están deshabilitadas. La aplicación continuará con procesamiento síncrono.',
        'ColaModule',
      );

      return {
        module: ColaModule,
        global: true,
        imports: baseImports,
        providers: baseProviders,
        exports: [
          ColaEvidenciasService,
          ColaEnviosService,
          EvidenciaProcesamientoService,
          EnvioProcesamientoService,
          REDIS_DISPONIBLE,
        ],
      };
    }

    Logger.log('Redis conectado. Colas Bull habilitadas.', 'ColaModule');

    return {
      module: ColaModule,
      global: true,
      imports: [
        ...baseImports,
        BullModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            redis: {
              host: configService.get<string>('REDIS_HOST', 'localhost'),
              port: configService.get<number>('REDIS_PORT', 6379),
              maxRetriesPerRequest: null,
            },
          }),
          inject: [ConfigService],
        }),
        BullModule.registerQueue(
          {
            name: NOMBRE_COLA_EVIDENCIAS,
            defaultJobOptions: {
              attempts: 3,
              backoff: { type: 'fixed', delay: 5000 },
            },
          },
          {
            name: NOMBRE_COLA_ENVIOS,
            defaultJobOptions: {
              attempts: 3,
              backoff: { type: 'fixed', delay: 5000 },
            },
          },
        ),
      ],
      providers: [
        ...baseProviders,
        ProcesadorEvidencia,
        ProcesadorEnvios,
      ],
      exports: [
        ColaEvidenciasService,
        ColaEnviosService,
        EvidenciaProcesamientoService,
        EnvioProcesamientoService,
        BullModule,
        REDIS_DISPONIBLE,
      ],
    };
  }
}
