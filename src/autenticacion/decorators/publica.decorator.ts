import { SetMetadata } from '@nestjs/common';
import { ES_PUBLICA_KEY } from '../constants/metadata-keys';

export const Publica = () => SetMetadata(ES_PUBLICA_KEY, true);
