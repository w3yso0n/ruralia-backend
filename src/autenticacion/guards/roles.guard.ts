import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../constants/metadata-keys';
import { RolEnum } from '../enums/rol.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RolEnum[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesRequeridos?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const usuario = request.usuario as Usuario | undefined;

    if (!usuario) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const tieneRol = usuario.roles?.some((rol) =>
      rolesRequeridos.includes(rol.nombre as RolEnum),
    );

    if (!tieneRol) {
      throw new ForbiddenException('No tiene permisos para acceder a este recurso');
    }

    return true;
  }
}
