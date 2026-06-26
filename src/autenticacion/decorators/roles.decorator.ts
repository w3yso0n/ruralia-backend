import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/metadata-keys';
import { RolEnum } from '../enums/rol.enum';

export const Roles = (...roles: RolEnum[]) => SetMetadata(ROLES_KEY, roles);
