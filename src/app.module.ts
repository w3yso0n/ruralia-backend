import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActividadesModule } from './actividades/actividades.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArchivosModule } from './archivos/archivos.module';
import { AsociacionesModule } from './asociaciones/asociaciones.module';
import { AutenticacionModule } from './autenticacion/autenticacion.module';
import { BeneficiariosModule } from './beneficiarios/beneficiarios.module';
import { EvidenciasModule } from './evidencias/evidencias.module';
import { FormulariosModule } from './formularios/formularios.module';
import { IndicadoresModule } from './indicadores/indicadores.module';
import { JornadasModule } from './jornadas/jornadas.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { ReportesModule } from './reportes/reportes.module';
import { SaludModule } from './salud/salud.module';
import { SincronizacionModule } from './sincronizacion/sincronizacion.module';
import { TerritoriosModule } from './territorios/territorios.module';
import { UsuariosModule } from './usuarios/usuarios.module';

const modulosBase = [
  ConfigModule.forRoot({ isGlobal: true }),
  TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ruralia',
    autoLoadEntities: true,
    synchronize: true,
  }),
  ThrottlerModule.forRoot([
    {
      ttl: 60000,
      limit: 100,
    },
  ]),
  UsuariosModule,
  TerritoriosModule,
  ProyectosModule,
  BeneficiariosModule,
  AsociacionesModule,
  ActividadesModule,
  JornadasModule,
  FormulariosModule,
  EvidenciasModule,
  IndicadoresModule,
  AutenticacionModule,
  SincronizacionModule,
  ArchivosModule,
  ReportesModule,
  SaludModule,
];

@Module({})
export class AppModule {
  static register(colaModule: DynamicModule): DynamicModule {
    return {
      module: AppModule,
      imports: [...modulosBase, colaModule],
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    };
  }
}
