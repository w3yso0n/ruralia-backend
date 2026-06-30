import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  construirDescripcionApi,
  TAGS_MODULOS,
} from './catalogo-modulos';
import { ESQUEMAS_TABLAS } from './esquemas-tablas';

export function configurarSwagger(app: INestApplication): void {
  const builder = new DocumentBuilder()
    .setTitle('Rural-IA API')
    .setDescription(construirDescripcionApi())
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT de Firebase',
      },
      'bearer',
    );

  for (const tag of TAGS_MODULOS) {
    builder.addTag(tag.name, tag.description);
  }

  const config = builder.build();

  const documento = SwaggerModule.createDocument(app, config, {
    extraModels: [...ESQUEMAS_TABLAS],
  });

  SwaggerModule.setup('api/documentacion', app, documento, {
    jsonDocumentUrl: 'api/documentacion-json',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
