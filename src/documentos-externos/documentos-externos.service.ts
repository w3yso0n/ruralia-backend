import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { AccionAuditoria } from '../common/workflow/accion-auditoria.enum';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FiltrosDocumentoExternoDto } from './dto/filtros-documento-externo.dto';
import { SubirDocumentoExternoDto } from './dto/subir-documento-externo.dto';
import { DocumentoExterno } from './entities/documento-externo.entity';

const EXTENSION_POR_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    '.xlsx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class DocumentosExternosService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(DocumentoExterno)
    private readonly documentoExternoRepository: Repository<DocumentoExterno>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async subir(
    archivo: Express.Multer.File,
    datos: SubirDocumentoExternoDto,
    usuario: Usuario,
  ): Promise<DocumentoExterno> {
    const rutaBase =
      this.configService.get<string>('RUTA_SUBIDAS') ||
      path.join(process.cwd(), 'subidas');
    const directorio = path.join(
      rutaBase,
      datos.proyectoId,
      'documentos-externos',
    );
    await fs.mkdir(directorio, { recursive: true });

    const extension =
      path.extname(archivo.originalname) ||
      EXTENSION_POR_MIME[archivo.mimetype] ||
      '';
    const nombreArchivo = `${randomUUID()}${extension}`;
    const rutaCompleta = path.join(directorio, nombreArchivo);
    const urlRelativa = path
      .join('subidas', datos.proyectoId, 'documentos-externos', nombreArchivo)
      .replace(/\\/g, '/');

    await fs.writeFile(rutaCompleta, archivo.buffer);

    const documento = this.documentoExternoRepository.create({
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      tipo: datos.tipo,
      nombreArchivo: archivo.originalname,
      urlArchivo: urlRelativa,
      tipoMime: archivo.mimetype,
      tamanoArchivo: archivo.size,
      proyectoId: datos.proyectoId,
      actividadId: datos.actividadId ?? null,
      subactividadId: datos.subactividadId ?? null,
      jornadaId: datos.jornadaId ?? null,
      beneficiarioId: datos.beneficiarioId ?? null,
      asociacionId: datos.asociacionId ?? null,
      veredaId: datos.veredaId ?? null,
      subidoPor: usuario,
    });

    const guardado = await this.documentoExternoRepository.save(documento);

    await this.auditoriaService.registrar({
      entityType: 'DocumentoExterno',
      entityId: guardado.id,
      action: AccionAuditoria.CREATE,
      user: usuario,
      projectId: datos.proyectoId,
      jornadaId: datos.jornadaId ?? null,
      newValue: {
        titulo: guardado.titulo,
        tipo: guardado.tipo,
        nombreArchivo: guardado.nombreArchivo,
      },
    });

    return guardado;
  }

  async listar(
    filtros: FiltrosDocumentoExternoDto,
  ): Promise<DocumentoExterno[]> {
    const query = this.documentoExternoRepository
      .createQueryBuilder('documento')
      .leftJoinAndSelect('documento.subidoPor', 'subidoPor')
      .leftJoinAndSelect('documento.jornada', 'jornada')
      .leftJoinAndSelect('documento.actividad', 'actividad')
      .leftJoinAndSelect('documento.subactividad', 'subactividad')
      .leftJoinAndSelect('documento.beneficiario', 'beneficiario')
      .leftJoinAndSelect('documento.asociacion', 'asociacion')
      .leftJoinAndSelect('documento.vereda', 'vereda')
      .orderBy('documento.creadoEn', 'DESC');

    if (filtros.proyectoId) {
      query.andWhere('documento.proyectoId = :proyectoId', {
        proyectoId: filtros.proyectoId,
      });
    }
    if (filtros.actividadId) {
      query.andWhere('documento.actividadId = :actividadId', {
        actividadId: filtros.actividadId,
      });
    }
    if (filtros.subactividadId) {
      query.andWhere('documento.subactividadId = :subactividadId', {
        subactividadId: filtros.subactividadId,
      });
    }
    if (filtros.jornadaId) {
      query.andWhere('documento.jornadaId = :jornadaId', {
        jornadaId: filtros.jornadaId,
      });
    }
    if (filtros.beneficiarioId) {
      query.andWhere('documento.beneficiarioId = :beneficiarioId', {
        beneficiarioId: filtros.beneficiarioId,
      });
    }
    if (filtros.asociacionId) {
      query.andWhere('documento.asociacionId = :asociacionId', {
        asociacionId: filtros.asociacionId,
      });
    }
    if (filtros.veredaId) {
      query.andWhere('documento.veredaId = :veredaId', {
        veredaId: filtros.veredaId,
      });
    }
    if (filtros.tipo) {
      query.andWhere('documento.tipo = :tipo', { tipo: filtros.tipo });
    }

    return query.getMany();
  }

  async obtenerUno(id: string): Promise<DocumentoExterno> {
    const documento = await this.documentoExternoRepository.findOne({
      where: { id },
      relations: {
        subidoPor: true,
        jornada: true,
        actividad: true,
        subactividad: true,
        beneficiario: true,
        asociacion: true,
        vereda: true,
      },
    });

    if (!documento) {
      throw new NotFoundException(`Documento externo ${id} no encontrado`);
    }

    return documento;
  }

  async eliminar(id: string, usuario: Usuario): Promise<void> {
    const documento = await this.obtenerUno(id);

    await this.documentoExternoRepository.remove(documento);

    await this.auditoriaService.registrar({
      entityType: 'DocumentoExterno',
      entityId: id,
      action: AccionAuditoria.DELETE_LOGICAL,
      user: usuario,
      projectId: documento.proyectoId,
      jornadaId: documento.jornadaId,
      previousValue: {
        titulo: documento.titulo,
        tipo: documento.tipo,
        nombreArchivo: documento.nombreArchivo,
      },
    });
  }
}
