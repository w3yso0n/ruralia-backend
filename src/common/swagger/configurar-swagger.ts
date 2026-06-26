import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configurarSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Rural-IA API')
    .setDescription('API del backend Rural-IA para gestión de proyectos rurales')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT de Firebase',
      },
      'bearer',
    )
    .build();

  const documento = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/documentacion', app, documento, {
    jsonDocumentUrl: 'api/documentacion-json',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
