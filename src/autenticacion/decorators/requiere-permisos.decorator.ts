import { SetMetadata } from '@nestjs/common';
import { PERMISOS_KEY } from '../constants/metadata-keys';

export const RequierePermisos = (...permisos: string[]) =>
  SetMetadata(PERMISOS_KEY, permisos);
