import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerPorUsuarioGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const usuario = req.usuario as { id?: string } | undefined;
    return usuario?.id ?? (req.ip as string) ?? 'desconocido';
  }
}
