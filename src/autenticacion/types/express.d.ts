import { Usuario } from '../../usuarios/entities/usuario.entity';

declare global {
  namespace Express {
    interface Request {
      usuario?: Usuario;
    }
  }
}

export {};
