import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Evidencia } from '../evidencias/entities/evidencia.entity';

/**
 * Recuperación de evidencias cuyo registro existe pero cuyo archivo ya no está
 * en disco (se perdieron al redeployar el contenedor sin volumen persistente).
 *
 * La app de campo busca en su caché local una copia con el mismo tamaño exacto
 * y la vuelve a subir a la misma evidencia, sin crear registros nuevos.
 *
 * Modo (variable RECUPERACION_EVIDENCIAS):
 * - "reporte" (por defecto): la app solo busca y reporta coincidencias.
 * - "subir": la app sube las coincidencias.
 * - "apagado": la app no hace nada.
 */
export type ModoRecuperacion = 'apagado' | 'reporte' | 'subir';

export interface EvidenciaSinArchivo {
  id: string;
  tamano: number;
  capturadoEn: string;
  nombreArchivo: string;
}

export interface ReporteRecuperacion {
  pendientes: number;
  coincidencias: number;
  archivosEnCache: number;
  subidas?: number;
  errores?: number;
}

@Injectable()
export class RecuperacionEvidenciasService {
  private readonly logger = new Logger(RecuperacionEvidenciasService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
  ) {}

  modo(): ModoRecuperacion {
    const valor = (
      this.configService.get<string>('RECUPERACION_EVIDENCIAS') ?? ''
    )
      .trim()
      .toLowerCase();
    if (valor === 'apagado' || valor === 'subir') return valor;
    return 'reporte';
  }

  /** Evidencias de las jornadas del usuario cuyo archivo ya no existe en disco. */
  async listarPendientes(usuarioId: string): Promise<{
    modo: ModoRecuperacion;
    evidencias: EvidenciaSinArchivo[];
  }> {
    const modo = this.modo();
    if (modo === 'apagado') return { modo, evidencias: [] };

    const filas: Array<{ id: string }> =
      await this.evidenciaRepository.manager.query(
        `SELECT j.id FROM jornadas j
         WHERE j.tecnico_responsable_id = $1
           OR EXISTS (SELECT 1 FROM jornada_equipo je
                      WHERE je.jornada_id = j.id AND je.usuario_id = $1)`,
        [usuarioId],
      );
    const jornadaIds = filas.map((f) => f.id);
    if (!jornadaIds.length) return { modo, evidencias: [] };

    const evidencias = await this.evidenciaRepository.find({
      select: {
        id: true,
        urlArchivo: true,
        tamanoArchivo: true,
        capturadoEn: true,
        nombreArchivo: true,
      },
      where: {
        jornada: { id: In(jornadaIds) },
        urlArchivo: Not(IsNull()),
        tamanoArchivo: Not(IsNull()),
      },
    });

    const conExistencia = await Promise.all(
      evidencias.map(async (e) => ({
        evidencia: e,
        existe: await this.existe(this.rutaAbsoluta(e.urlArchivo)),
      })),
    );

    return {
      modo,
      evidencias: conExistencia
        .filter((x) => !x.existe)
        .map(({ evidencia: e }) => ({
          id: e.id,
          tamano: Number(e.tamanoArchivo),
          capturadoEn: e.capturadoEn.toISOString(),
          nombreArchivo: e.nombreArchivo,
        })),
    };
  }

  registrarReporte(usuarioId: string, reporte: ReporteRecuperacion): void {
    this.logger.log(
      `[recuperacion] modo=${this.modo()} usuario=${usuarioId}` +
        ` pendientes=${reporte.pendientes}` +
        ` coincidencias=${reporte.coincidencias}` +
        ` archivosEnCache=${reporte.archivosEnCache}` +
        (reporte.subidas !== undefined ? ` subidas=${reporte.subidas}` : '') +
        (reporte.errores !== undefined ? ` errores=${reporte.errores}` : ''),
    );
  }

  /**
   * Restaura el archivo de una evidencia en la misma ruta que tenía, así la URL
   * guardada vuelve a funcionar sin tocar el registro.
   */
  async recuperar(
    archivo: Express.Multer.File,
    evidenciaId: string,
  ): Promise<{ recuperada: true }> {
    if (this.modo() !== 'subir') {
      throw new ForbiddenException(
        'La recuperación de archivos no está activa',
      );
    }

    const evidencia = await this.evidenciaRepository.findOne({
      where: { id: evidenciaId },
    });
    if (!evidencia) {
      throw new NotFoundException(`Evidencia ${evidenciaId} no encontrada`);
    }
    if (!evidencia.urlArchivo || evidencia.tamanoArchivo == null) {
      throw new BadRequestException('La evidencia no tiene archivo registrado');
    }
    if (archivo.size !== Number(evidencia.tamanoArchivo)) {
      throw new BadRequestException(
        'El archivo no coincide con el registrado en la evidencia',
      );
    }

    const rutaArchivo = this.rutaAbsoluta(evidencia.urlArchivo);
    if (await this.existe(rutaArchivo)) {
      // Otro dispositivo ya la recuperó: no se sobrescribe.
      return { recuperada: true };
    }

    await fs.mkdir(path.dirname(rutaArchivo), { recursive: true });
    await fs.writeFile(rutaArchivo, archivo.buffer);

    if (evidencia.urlMiniatura && evidencia.tipoMime?.startsWith('image/')) {
      await this.regenerarMiniatura(
        rutaArchivo,
        this.rutaAbsoluta(evidencia.urlMiniatura),
      );
    }

    this.logger.log(`[recuperacion] evidencia ${evidenciaId} restaurada`);
    return { recuperada: true };
  }

  private async regenerarMiniatura(origen: string, destino: string) {
    try {
      const sharp = await import('sharp');
      await sharp
        .default(origen)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .toFile(destino);
    } catch (error) {
      this.logger.warn(
        `[recuperacion] no se pudo regenerar la miniatura ${destino}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private rutaBase(): string {
    return path.resolve(
      this.configService.get<string>('RUTA_SUBIDAS') ||
        path.join(process.cwd(), 'subidas'),
    );
  }

  private rutaAbsoluta(url: string): string {
    const base = this.rutaBase();
    const ruta = path.resolve(base, url.replace(/^\/?subidas[/\\]/, ''));
    if (!ruta.startsWith(base + path.sep)) {
      throw new ConflictException('Ruta de archivo inválida');
    }
    return ruta;
  }

  private async existe(ruta: string): Promise<boolean> {
    try {
      await fs.access(ruta);
      return true;
    } catch {
      return false;
    }
  }
}
