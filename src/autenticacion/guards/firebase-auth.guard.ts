import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ES_PUBLICA_KEY } from '../constants/metadata-keys';
import { AutenticacionService } from '../autenticacion.service';
import { FirebaseAdminService } from '../firebase-admin.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly autenticacionService: AutenticacionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(
      ES_PUBLICA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (esPublica) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === 'OPTIONS') {
      return true;
    }

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const token = authorization.slice('Bearer '.length);

    let decoded: Awaited<ReturnType<FirebaseAdminService['verificarToken']>>;
    try {
      decoded = await this.firebaseAdminService.verificarToken(token);
    } catch (error) {
      const { code, message } = error as { code?: string; message?: string };
      this.logger.warn(
        `Token de Firebase rechazado: ${code ?? 'sin-codigo'} ${message ?? ''}`,
      );
      throw new UnauthorizedException('Token inválido o expirado');
    }

    let usuario: Awaited<
      ReturnType<AutenticacionService['obtenerOCrearUsuario']>
    >;
    try {
      usuario = await this.autenticacionService.obtenerOCrearUsuario(decoded);
    } catch (error) {
      // No es un problema del token: no se disfraza de 401.
      this.logger.error(
        `No se pudo cargar el usuario ${decoded.uid}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'No se pudo cargar el usuario. Intenta de nuevo más tarde.',
      );
    }

    if (!usuario.estaActivo) {
      throw new ForbiddenException('Usuario desactivado');
    }

    request.usuario = usuario;
    return true;
  }
}
