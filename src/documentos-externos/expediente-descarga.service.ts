import { FaseFormulario } from '../formularios/enums/fase-formulario.enum';
import { leerDataUrl } from '../common/utils/data-url';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ZipArchive, type ZipEntryData } from 'archiver';
import { existsSync, promises as fsp } from 'fs';
import * as path from 'path';
import type { Response } from 'express';
import { In, Repository } from 'typeorm';
import { Documento } from '../documentos/entities/documento.entity';
import { DocumentoVersion } from '../documentos/entities/documento-version.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { DescargarExpedienteDto } from './dto/descargar-expediente.dto';
import { DocumentoExterno } from './entities/documento-externo.entity';

type EntradaZip =
  | { tipo: 'archivo'; rutaZip: string; rutaDisco: string; bytes?: number }
  | { tipo: 'buffer'; rutaZip: string; contenido: Buffer };

/**
 * Largo máximo de cada nivel de carpeta y de la ruta completa dentro del ZIP.
 * El Explorador de Windows no extrae rutas de más de 260 caracteres y avisa que
 * la carpeta comprimida "no es válida". Contando la carpeta de destino
 * (Descargas del usuario + carpeta con el nombre del ZIP, unos 80 caracteres),
 * la ruta interna debe quedar por debajo de ~170.
 */
const LARGO_NIVEL_PLAN = 24;
const LARGO_CARPETA_JORNADA = 40;
const LARGO_ARCHIVO = 40;
const LARGO_NOMBRE_ZIP = 40;
const LARGO_MAXIMO_RUTA = 165;

/** Formatos ya comprimidos: se guardan sin volver a comprimir (más rápido). */
const EXTENSIONES_SIN_COMPRIMIR = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.pdf',
  '.zip',
  '.docx',
  '.xlsx',
  '.pptx',
  '.mp4',
  '.mov',
  '.mp3',
  '.m4a',
]);

@Injectable()
export class ExpedienteDescargaService {
  private readonly logger = new Logger(ExpedienteDescargaService.name);

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
    @InjectRepository(DocumentoExterno)
    private readonly externoRepo: Repository<DocumentoExterno>,
  ) {}

  async escribirZip(
    proyectoId: string,
    filtros: DescargarExpedienteDto,
    res: Response,
  ) {
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      throw new BadRequestException(
        'La fecha inicial no puede ser posterior a la final',
      );
    }
    if (
      (filtros.desde && !filtros.hasta) ||
      (!filtros.desde && filtros.hasta)
    ) {
      throw new BadRequestException('Indica la fecha inicial y la final');
    }

    const proyecto = await this.proyectoRepo.findOne({
      where: { id: proyectoId },
    });
    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }

    const porIds = filtros.jornadaIds !== undefined;
    // Con jornadaIds se descargan exactamente las jornadas filtradas en la
    // pantalla de jornadas. Sin ellas, el expediente deja fuera la línea base.
    const jornadas = await this.jornadaRepo.find({
      where: porIds
        ? { proyecto: { id: proyectoId }, id: In(filtros.jornadaIds ?? []) }
        : { proyecto: { id: proyectoId }, fase: FaseFormulario.EJECUCION },
      relations: {
        meta: { proceso: { subactividad: { actividad: true } } },
        tecnicoResponsable: true,
      },
      order: { fecha: 'ASC' },
    });

    const elegidas = porIds
      ? jornadas
      : jornadas.filter((jornada) => this.cumpleFiltros(jornada, filtros));
    if (porIds && !elegidas.length) {
      throw new BadRequestException(
        'No hay jornadas para descargar con esos filtros.',
      );
    }
    const idsElegidas = elegidas.map((jornada) => jornada.id);

    // Solo se cargan los archivos de las jornadas elegidas: los envíos traen
    // las fotos como data URL y cargar los de todo el proyecto es muy pesado.
    const [documentos, evidencias, envios, externos] = await Promise.all([
      idsElegidas.length
        ? this.documentoRepo.find({
            where: { proyectoId, jornadaId: In(idsElegidas) },
            relations: { versiones: true },
          })
        : Promise.resolve([] as Documento[]),
      idsElegidas.length
        ? this.evidenciaRepo.find({
            where: { jornada: { id: In(idsElegidas) } },
            relations: { jornada: true },
          })
        : Promise.resolve([] as Evidencia[]),
      idsElegidas.length
        ? this.envioRepo.find({
            where: { jornada: { id: In(idsElegidas) } },
            relations: { respuestas: { campoFormulario: true }, jornada: true },
          })
        : Promise.resolve([] as EnvioFormulario[]),
      filtros.incluirExternos && !porIds
        ? this.externoRepo.find({
            where: { proyectoId },
            order: { creadoEn: 'ASC' },
          })
        : Promise.resolve([] as DocumentoExterno[]),
    ]);

    const usadas = new Set<string>();
    const entradas: EntradaZip[] = [];
    const filasIndice: string[][] = [];

    for (const jornada of elegidas) {
      const carpeta = this.carpetaJornada(jornada);
      const totalAntes = entradas.length;
      for (const documento of documentos.filter(
        (doc) => doc.jornadaId === jornada.id,
      )) {
        const version = this.versionVigente(documento);
        const disco = version?.filePath
          ? this.resolverRuta(version.filePath)
          : null;
        if (!disco) continue;
        entradas.push({
          tipo: 'archivo',
          rutaDisco: disco,
          rutaZip: this.rutaUnica(
            usadas,
            `${carpeta}/${this.segmento(documento.titulo, LARGO_ARCHIVO)}.pdf`,
          ),
        });
      }

      for (const evidencia of evidencias) {
        if (evidencia.jornada?.id !== jornada.id || !evidencia.urlArchivo)
          continue;
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
            LARGO_ARCHIVO,
          );
          if (adjunto.tipo === 'archivo') {
            entradas.push({
              tipo: 'archivo',
              rutaDisco: adjunto.rutaDisco,
              rutaZip: this.rutaUnica(
                usadas,
                `${carpeta}/adjuntos/${etiqueta}${adjunto.extension}`,
              ),
            });
          } else {
            entradas.push({
              tipo: 'buffer',
              contenido: adjunto.contenido,
              rutaZip: this.rutaUnica(
                usadas,
                `${carpeta}/adjuntos/${etiqueta}${adjunto.extension}`,
              ),
            });
          }
        }
      }

      filasIndice.push([
        carpeta,
        this.fechaIso(jornada.fecha),
        jornada.nombre?.trim() || '',
        jornada.tecnicoResponsableNombre || '',
        jornada.meta?.proceso?.subactividad?.actividad?.nombre ?? '',
        jornada.meta?.proceso?.subactividad?.nombre ?? '',
        jornada.meta?.proceso?.nombre ?? '',
        jornada.meta?.nombre ?? '',
        String(jornada.estado ?? ''),
        String(entradas.length - totalAntes),
      ]);
    }

    for (const externo of externos) {
      const disco = this.resolverRuta(externo.urlArchivo);
      if (!disco) continue;
      entradas.push({
        tipo: 'archivo',
        rutaDisco: disco,
        rutaZip: this.rutaUnica(
          usadas,
          `documentos-externos/${this.nombreExterno(externo)}`,
        ),
      });
    }

    // Se mide cada archivo antes de empezar: los que no se pueden leer se
    // omiten aquí y no a mitad de la descarga, donde dejarían el ZIP cortado.
    const medidas = await Promise.all(
      entradas.map(async (entrada): Promise<EntradaZip | null> => {
        if (entrada.tipo === 'buffer') return entrada;
        try {
          const info = await fsp.stat(entrada.rutaDisco);
          return info.isFile() ? { ...entrada, bytes: info.size } : null;
        } catch {
          return null;
        }
      }),
    );
    const listas = medidas.filter(
      (entrada): entrada is EntradaZip => entrada !== null,
    );

    if (!listas.length) {
      throw new BadRequestException(
        porIds
          ? 'Las jornadas filtradas no tienen archivos para descargar.'
          : 'No hay evidencias con esos filtros. Prueba otro rango, proceso o agente.',
      );
    }

    const bytesEstimados = listas.reduce(
      (total, entrada) =>
        total +
        (entrada.tipo === 'buffer'
          ? entrada.contenido.length
          : (entrada.bytes ?? 0)),
      0,
    );

    const sufijo = porIds ? 'jornadas' : 'expediente';
    const nombreZip = `${this.segmento(proyecto.nombre, LARGO_NOMBRE_ZIP)}-${sufijo}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreZip}"; filename*=UTF-8''${encodeURIComponent(nombreZip)}`,
    );
    res.setHeader('X-Expediente-Archivos', String(listas.length));
    res.setHeader('X-Expediente-Jornadas', String(elegidas.length));
    res.setHeader('X-Expediente-Bytes', String(bytesEstimados));
    res.setHeader('Cache-Control', 'no-store');

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('warning', (error) => {
      this.logger.warn(`Archivo omitido del ZIP: ${error.message}`);
    });
    archive.on('error', (error) => {
      this.logger.error(`Error armando el ZIP: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).end(error.message);
        return;
      }
      // Ya se enviaron datos: se corta la conexión para que el navegador
      // marque la descarga como fallida en vez de guardar un ZIP incompleto.
      res.destroy(error);
    });
    res.on('close', () => {
      if (!res.writableFinished) archive.abort();
    });
    archive.pipe(res);

    for (const entrada of listas) {
      const store = EXTENSIONES_SIN_COMPRIMIR.has(
        path.extname(entrada.rutaZip).toLowerCase(),
      );
      // Los tipos de archiver no declaran `store` en file(), pero el plugin
      // zip lo recibe igual.
      const datos: ZipEntryData = { name: entrada.rutaZip, store };
      if (entrada.tipo === 'archivo') {
        archive.file(entrada.rutaDisco, datos);
      } else {
        archive.append(entrada.contenido, datos);
      }
    }

    archive.append(this.indiceCsv(filasIndice), {
      name: 'indice-jornadas.csv',
    });

    await archive.finalize();
  }

  /** Nombres completos de cada carpeta, ya que en el ZIP van recortados. */
  private indiceCsv(filas: string[][]) {
    const encabezado = [
      'Carpeta',
      'Fecha',
      'Jornada',
      'Agente',
      'Actividad',
      'Subactividad',
      'Proceso',
      'Meta',
      'Estado',
      'Archivos',
    ];
    const celda = (valor: string) => `"${valor.replace(/"/g, '""')}"`;
    const lineas = [encabezado, ...filas].map((fila) =>
      fila.map(celda).join(';'),
    );
    // BOM para que Excel lea bien las tildes.
    return Buffer.from(`\uFEFF${lineas.join('\r\n')}\r\n`, 'utf8');
  }

  private cumpleFiltros(jornada: Jornada, filtros: DescargarExpedienteDto) {
    const fecha = this.fechaIso(jornada.fecha);
    if (filtros.desde && filtros.hasta) {
      if (
        fecha < filtros.desde.slice(0, 10) ||
        fecha > filtros.hasta.slice(0, 10)
      ) {
        return false;
      }
    }
    if (filtros.procesoId && jornada.meta?.proceso?.id !== filtros.procesoId) {
      return false;
    }
    if (
      filtros.agenteId &&
      jornada.tecnicoResponsable?.id !== filtros.agenteId
    ) {
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
      this.segmento(actividad || 'Sin actividad', LARGO_NIVEL_PLAN),
      this.segmento(subactividad || 'Sin subactividad', LARGO_NIVEL_PLAN),
      this.segmento(proceso || 'Sin proceso', LARGO_NIVEL_PLAN),
      this.segmento(meta || 'Sin meta', LARGO_NIVEL_PLAN),
      this.segmento(`${fecha} ${nombre} ${agente}`, LARGO_CARPETA_JORNADA),
    ].join('/');
  }

  private versionVigente(documento: Documento): DocumentoVersion | undefined {
    const versiones = documento.versiones ?? [];
    const vigente = versiones.find(
      (version) => version.id === documento.versionVigenteId,
    );
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
    // Fotos, firmas y archivos de la app llegan como data URL en urlArchivo.
    const data =
      leerDataUrl(respuesta.urlArchivo) ?? leerDataUrl(respuesta.valorTexto);
    if (data) {
      const deNombre = data.nombre ? path.extname(data.nombre) : '';
      return {
        tipo: 'buffer',
        contenido: Buffer.from(data.base64, 'base64'),
        extension: deNombre || this.extensionMime(data.mime),
      };
    }
    if (respuesta.urlArchivo) {
      const disco = this.resolverRuta(respuesta.urlArchivo);
      if (!disco) return null;
      return {
        tipo: 'archivo',
        rutaDisco: disco,
        extension: path.extname(respuesta.urlArchivo) || this.extensionMime(''),
      };
    }
    return null;
  }

  private resolverRuta(filePath: string): string | null {
    if (filePath.startsWith('data:') || /^https?:\/\//i.test(filePath))
      return null;
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

  private rutaUnica(usadas: Set<string>, rutaOriginal: string) {
    const ruta = this.acotarRuta(rutaOriginal);
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

  /** Recorta el nombre del archivo si la ruta completa pasa del máximo. */
  private acotarRuta(ruta: string) {
    if (ruta.length <= LARGO_MAXIMO_RUTA) return ruta;
    const dir = path.posix.dirname(ruta);
    const base = path.posix.basename(ruta);
    const extension = path.posix.extname(base);
    const nombre = base.slice(0, base.length - extension.length);
    const disponible = Math.max(
      8,
      LARGO_MAXIMO_RUTA - dir.length - 1 - extension.length,
    );
    return `${dir}/${this.segmento(nombre, disponible)}${extension}`;
  }

  private nombreConExtension(nombre: string, mime: string) {
    const original = nombre || 'archivo';
    const extension = path.extname(original);
    if (extension && extension.length <= 6) {
      const base = original.slice(0, original.length - extension.length);
      return `${this.segmento(base, LARGO_ARCHIVO)}${extension.toLowerCase()}`;
    }
    return `${this.segmento(original, LARGO_ARCHIVO)}${this.extensionMime(mime)}`;
  }

  private nombreExterno(externo: DocumentoExterno) {
    const nombre = this.segmento(
      externo.nombreArchivo || externo.titulo || 'documento',
    );
    if (path.extname(nombre)) return nombre;
    const extension = path.extname(externo.urlArchivo);
    return extension
      ? `${nombre}${extension}`
      : `${nombre}${this.extensionMime(externo.tipoMime ?? '')}`;
  }

  private extensionMime(mime: string) {
    if (mime.includes('png')) return '.png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('pdf')) return '.pdf';
    if (mime.includes('gif')) return '.gif';
    if (mime.includes('wordprocessingml')) return '.docx';
    if (mime.includes('msword')) return '.doc';
    if (mime.includes('spreadsheetml')) return '.xlsx';
    if (mime.includes('ms-excel')) return '.xls';
    return '.bin';
  }

  private segmento(valor: string, largo = 80) {
    const limpio = (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Caracteres que Windows no acepta en nombres de archivo o carpeta.
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\p{Cc}/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Windows tampoco acepta nombres que terminan en espacio o punto.
    const recortado = (limpio || 'sin-nombre')
      .slice(0, largo)
      .replace(/[ .]+$/, '');
    return recortado || 'sin-nombre';
  }

  private fechaIso(fecha: Date | string) {
    if (typeof fecha === 'string') return fecha.slice(0, 10);
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
}
