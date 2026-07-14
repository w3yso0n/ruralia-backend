import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AutenticacionController } from './autenticacion.controller';
import { AutenticacionService } from './autenticacion.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [forwardRef(() => UsuariosModule)],
  controllers: [AutenticacionController],
  providers: [
    FirebaseAdminService,
    AutenticacionService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [FirebaseAdminService, AutenticacionService],
})
export class AutenticacionModule {}
