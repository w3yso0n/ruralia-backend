import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ES_PUBLICA_KEY } from '../constants/metadata-keys';
import { AutenticacionService } from '../autenticacion.service';
import { FirebaseAdminService } from '../firebase-admin.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly autenticacionService: AutenticacionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(ES_PUBLICA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (esPublica) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const token = authorization.slice('Bearer '.length);

    try {
      const decoded = await this.firebaseAdminService.verificarToken(token);
      request.usuario =
        await this.autenticacionService.obtenerOCrearUsuario(decoded);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
