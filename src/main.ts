import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ColaModule } from './cola/cola.module';
import { configurarSwagger } from './common/swagger/configurar-swagger';
import { AppModule } from './app.module';
import { migrarRolesNombreAntesDeSync } from './usuarios/migrar-roles-nombre';
import { migrarTerritoriosAntesDeSync } from './territorios/migrar-territorios-esquema';

async function bootstrap() {
  // Debe correr antes de TypeORM synchronize.
  await migrarRolesNombreAntesDeSync();
  await migrarTerritoriosAntesDeSync();

  const colaModule = await ColaModule.forRoot();
  const app = await NestFactory.create(AppModule.register(colaModule));

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

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
