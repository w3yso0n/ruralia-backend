import { SetMetadata } from '@nestjs/common';
import { SOLO_AUTENTICADO_KEY } from '../constants/metadata-keys';

export const SoloAutenticado = () => SetMetadata(SOLO_AUTENTICADO_KEY, true);
