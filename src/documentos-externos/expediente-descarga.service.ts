import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ZipArchive } from 'archiver';
import { existsSync } from 'fs';
import * as path from 'path';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { Documento } from '../documentos/entities/documento.entity';
import { DocumentoVersion } from '../documentos/entities/documento-version.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { DescargarExpedienteDto } from './dto/descargar-expediente.dto';

type EntradaZip =
  | { tipo: 'archivo'; rutaZip: string; rutaDisco: string }
  | { tipo: 'buffer'; rutaZip: string; contenido: Buffer };

@Injectable()
export class ExpedienteDescargaService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Jornada)
    private readonly jornadaRepo: Repository<Jornada>,
    @InjectRepository(Documento)
    private readonly documentoRepo: Repository<Documento>,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepo: Repository<Evidencia>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepo: Repository<EnvioFormulario>,
    @InjectRepository(Proyecto)
    private readonly proyectoRepo: Repository<Proyecto>,
  ) {}

  async escribirZip(
    proyectoId: string,
    filtros: DescargarExpedienteDto,
    res: Response,
  ) {
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
    }
    if ((filtros.desde && !filtros.hasta) || (!filtros.desde && filtros.hasta)) {
      throw new BadRequestException('Indica la fecha inicial y la final');
    }

    const proyecto = await this.proyectoRepo.findOne({ where: { id: proyectoId } });
    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }

    const jornadas = await this.jornadaRepo.find({
      where: { proyecto: { id: proyectoId } },
      relations: {
        meta: { proceso: { subactividad: { actividad: true } } },
        tecnicoResponsable: true,
      },
      order: { fecha: 'ASC' },
    });

    const elegidas = jornadas.filter((jornada) => this.cumpleFiltros(jornada, filtros));
    const ids = new Set(elegidas.map((jornada) => jornada.id));

    const [documentos, evidencias, envios] = await Promise.all([
      this.documentoRepo.find({
        where: { proyectoId },
        relations: { versiones: true },
      }),
      this.evidenciaRepo.find({
        where: { jornada: { proyecto: { id: proyectoId } } },
        relations: { jornada: true },
      }),
      this.envioRepo.find({
        where: { jornada: { proyecto: { id: proyectoId } } },
        relations: { respuestas: { campoFormulario: true }, jornada: true },
      }),
    ]);

    const usadas = new Set<string>();
    const entradas: EntradaZip[] = [];

    for (const jornada of elegidas) {
      const carpeta = this.carpetaJornada(jornada);
      for (const documento of documentos.filter((doc) => doc.jornadaId === jornada.id)) {
        const version = this.versionVigente(documento);
        const disco = version?.filePath ? this.resolverRuta(version.filePath) : null;
        if (!disco) continue;
        entradas.push({
          tipo: 'archivo',
          rutaDisco: disco,
          rutaZip: this.rutaUnica(
            usadas,
            `${carpeta}/${this.segmento(documento.titulo)}.pdf`,
          ),
        });
      }

      for (const evidencia of evidencias) {
        if (evidencia.jornada?.id !== jornada.id || !evidencia.urlArchivo) continue;
        const disco = this.resolverRuta(evidencia.urlArchivo);
        if (!disco) continue;
        const nombre = this.nombreConExtension(
          evidencia.nombreArchivo,
          evidencia.tipoMime,
        );
        entradas.push({
          tipo: 'archivo',
          rutaDisco: disco,
          rutaZip: this.rutaUnica(usadas, `${carpeta}/evidencias/${nombre}`),
        });
      }

      for (const envio of envios) {
        if (envio.jornada?.id !== jornada.id) continue;
        for (const respuesta of envio.respuestas ?? []) {
          const adjunto = this.adjunto(respuesta);
          if (!adjunto) continue;
          const etiqueta = this.segmento(
            respuesta.campoFormulario?.etiqueta ?? respuesta.claveCampo,
          );
          if (adjunto.tipo === 'archivo') {
            entradas.push({
              tipo: 'archivo',
              rutaDisco: adjunto.rutaDisco,
              rutaZip: this.rutaUnica(
                usadas,
                `${carpeta}/adjuntos-formulario/${etiqueta}${adjunto.extension}`,
              ),
            });
          } else {
            entradas.push({
              tipo: 'buffer',
              contenido: adjunto.contenido,
              rutaZip: this.rutaUnica(
                usadas,
                `${carpeta}/adjuntos-formulario/${etiqueta}.${adjunto.extension}`,
              ),
            });
          }
        }
      }
    }

    if (!entradas.length || !ids.size) {
      throw new BadRequestException(
        'No hay evidencias con esos filtros. Prueba otro rango, proceso o agente.',
      );
    }

    const nombreZip = `${this.segmento(proyecto.nombre)}-expediente.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreZip}"`,
    );

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (error) => {
      if (!res.headersSent) {
        res.status(500).end(error.message);
      }
    });
    archive.pipe(res);

    for (const entrada of entradas) {
      if (entrada.tipo === 'archivo') {
        archive.file(entrada.rutaDisco, { name: entrada.rutaZip });
      } else {
        archive.append(entrada.contenido, { name: entrada.rutaZip });
      }
    }

    await archive.finalize();
  }

  private cumpleFiltros(jornada: Jornada, filtros: DescargarExpedienteDto) {
    const fecha = this.fechaIso(jornada.fecha);
    if (filtros.desde && filtros.hasta) {
      if (fecha < filtros.desde.slice(0, 10) || fecha > filtros.hasta.slice(0, 10)) {
        return false;
      }
    }
    if (filtros.procesoId && jornada.meta?.proceso?.id !== filtros.procesoId) {
      return false;
    }
    if (filtros.agenteId && jornada.tecnicoResponsable?.id !== filtros.agenteId) {
      return false;
    }
    return true;
  }

  private carpetaJornada(jornada: Jornada) {
    const actividad = jornada.meta?.proceso?.subactividad?.actividad?.nombre;
    const subactividad = jornada.meta?.proceso?.subactividad?.nombre;
    const proceso = jornada.meta?.proceso?.nombre;
    const meta = jornada.meta?.nombre;
    const fecha = this.fechaIso(jornada.fecha);
    const nombre = jornada.nombre?.trim() || 'Jornada';
    const agente = jornada.tecnicoResponsableNombre || 'Sin agente';
    return [
      this.segmento(actividad || 'Sin actividad'),
      this.segmento(subactividad || 'Sin subactividad'),
      this.segmento(proceso || 'Sin proceso'),
      this.segmento(meta || 'Sin meta'),
      this.segmento(`${fecha} ${nombre} ${agente}`),
    ].join('/');
  }

  private versionVigente(documento: Documento): DocumentoVersion | undefined {
    const versiones = documento.versiones ?? [];
    const vigente = versiones.find((version) => version.id === documento.versionVigenteId);
    if (vigente?.filePath) return vigente;
    return [...versiones]
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .find((version) => version.filePath);
  }

  private adjunto(
    respuesta: RespuestaFormulario,
  ):
    | { tipo: 'archivo'; rutaDisco: string; extension: string }
    | { tipo: 'buffer'; contenido: Buffer; extension: string }
    | null {
    if (respuesta.urlArchivo) {
      const disco = this.resolverRuta(respuesta.urlArchivo);
      if (!disco) return null;
      return {
        tipo: 'archivo',
        rutaDisco: disco,
        extension: path.extname(respuesta.urlArchivo) || this.extensionMime(''),
      };
    }
    const texto = respuesta.valorTexto ?? '';
    const data = texto.match(/^data:([^;]+);base64,(.+)$/);
    if (!data) return null;
    return {
      tipo: 'buffer',
      contenido: Buffer.from(data[2], 'base64'),
      extension: this.extensionMime(data[1]),
    };
  }

  private resolverRuta(filePath: string): string | null {
    if (filePath.startsWith('data:') || /^https?:\/\//i.test(filePath)) return null;
    if (path.isAbsolute(filePath) && existsSync(filePath)) return filePath;
    const enCwd = path.join(process.cwd(), filePath);
    if (existsSync(enCwd)) return enCwd;
    const rutaBase =
      this.configService.get<string>('RUTA_SUBIDAS') ||
      path.join(process.cwd(), 'subidas');
    const relativo = filePath.replace(/^subidas[/\\]/, '');
    const enBase = path.join(rutaBase, relativo);
    if (existsSync(enBase)) return enBase;
    return null;
  }

  private rutaUnica(usadas: Set<string>, ruta: string) {
    if (!usadas.has(ruta)) {
      usadas.add(ruta);
      return ruta;
    }
    const dir = path.posix.dirname(ruta);
    const base = path.posix.basename(ruta);
    const punto = base.lastIndexOf('.');
    const nombre = punto > 0 ? base.slice(0, punto) : base;
    const extension = punto > 0 ? base.slice(punto) : '';
    let n = 2;
    let candidata = `${dir}/${nombre}-${n}${extension}`;
    while (usadas.has(candidata)) {
      n += 1;
      candidata = `${dir}/${nombre}-${n}${extension}`;
    }
    usadas.add(candidata);
    return candidata;
  }

  private nombreConExtension(nombre: string, mime: string) {
    const limpio = this.segmento(nombre || 'archivo');
    if (path.extname(limpio)) return limpio;
    return `${limpio}${this.extensionMime(mime)}`;
  }

  private extensionMime(mime: string) {
    if (mime.includes('png')) return '.png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('pdf')) return '.pdf';
    if (mime.includes('gif')) return '.gif';
    return '.bin';
  }

  private segmento(valor: string) {
    const limpio = valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return (limpio || 'sin-nombre').slice(0, 80);
  }

  private fechaIso(fecha: Date | string) {
    if (typeof fecha === 'string') return fecha.slice(0, 10);
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
}
