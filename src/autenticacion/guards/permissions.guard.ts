import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { usuarioTienePermisos } from '../../usuarios/utils/permisos-usuario';
import {
  ES_PUBLICA_KEY,
  PERMISOS_KEY,
  SOLO_AUTENTICADO_KEY,
} from '../constants/metadata-keys';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const esPublica = this.reflector.getAllAndOverride<boolean>(ES_PUBLICA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) {
      return true;
    }

    const soloAutenticado = this.reflector.getAllAndOverride<boolean>(
      SOLO_AUTENTICADO_KEY,
      [context.getHandler(), context.getClass()],
    );

    const permisosRequeridos = this.reflector.getAllAndOverride<string[]>(
      PERMISOS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === 'OPTIONS') {
      return true;
    }

    const usuario = request.usuario as Usuario | undefined;

    if (!usuario) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    if (!usuario.estaActivo) {
      throw new ForbiddenException('Usuario desactivado');
    }

    if (permisosRequeridos?.length) {
      if (!usuarioTienePermisos(usuario, permisosRequeridos)) {
        throw new ForbiddenException(
          'No tiene permisos para acceder a este recurso',
        );
      }
      return true;
    }

    if (soloAutenticado) {
      return true;
    }

    // Fail-closed: sin @RequierePermisos ni @SoloAutenticado → 403
    throw new ForbiddenException(
      'Este recurso no tiene política de permisos definida',
    );
  }
}
