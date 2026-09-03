import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { ColaModule } from './cola/cola.module';
import { configurarSwagger } from './common/swagger/configurar-swagger';
import { AppModule } from './app.module';
import { migrarRolesNombreAntesDeSync } from './usuarios/migrar-roles-nombre';
import { migrarTerritoriosAntesDeSync } from './territorios/migrar-territorios-esquema';
import { migrarJornadaHistorialAntesDeSync } from './jornadas/migrar-jornada-historial';
import { migrarTipoCampoTablaAntesDeSync } from './formularios/migrar-tipo-campo-tabla';

const ORIGENES_POR_DEFECTO = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://ruralia.tech',
  'https://www.ruralia.tech',
];

function origenPermitido(origin: string): boolean {
  const extra = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const permitidos = new Set([...ORIGENES_POR_DEFECTO, ...extra]);
  if (permitidos.has(origin)) return true;

  try {
    const host = new URL(origin).hostname;
    return host === 'ruralia.tech' || host.endsWith('.ruralia.tech');
  } catch {
    return false;
  }
}

async function bootstrap() {
  // Debe correr antes de TypeORM synchronize.
  await migrarRolesNombreAntesDeSync();
  await migrarTerritoriosAntesDeSync();
  await migrarJornadaHistorialAntesDeSync();
  await migrarTipoCampoTablaAntesDeSync();

  const colaModule = await ColaModule.forRoot();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(colaModule),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origenPermitido(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  const rutaSubidas =
    process.env.RUTA_SUBIDAS || path.join(process.cwd(), 'subidas');
  app.useStaticAssets(rutaSubidas, { prefix: '/subidas' });


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  configurarSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

