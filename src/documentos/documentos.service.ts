import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AccionAuditoria } from '../common/workflow/accion-auditoria.enum';
import { EstadoFuncional } from '../common/workflow/estado-funcional.enum';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { TipoJornada } from '../jornadas/enums/tipo-jornada.enum';
import { JornadasService } from '../jornadas/jornadas.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { EstadoVersionDocumento } from './enums/estado-version-documento.enum';
import { TipoDocumento } from './enums/tipo-documento.enum';
import { Documento } from './entities/documento.entity';
import { DocumentoVersion } from './entities/documento-version.entity';

export type CampoSnapshot = {
  clave: string;
  etiqueta: string;
  tipo: string;
  valor: unknown;
};

@Injectable()
export class DocumentosService {
  constructor(
    @InjectRepository(Documento)
    private readonly documentoRepo: Repository<Documento>,
    @InjectRepository(DocumentoVersion)
    private readonly versionRepo: Repository<DocumentoVersion>,
    @InjectRepository(Jornada)
    private readonly jornadaRepo: Repository<Jornada>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepo: Repository<EnvioFormulario>,
    private readonly jornadasService: JornadasService,
    private readonly auditoriaService: AuditoriaService,
    private readonly configService: ConfigService,
  ) {}

  async listarPorJornada(jornadaId: string): Promise<Documento[]> {
    return this.documentoRepo.find({
      where: { jornadaId },
      relations: { versiones: true },
      order: { creadoEn: 'DESC' },
    });
  }

  async listarPorProyecto(proyectoId: string): Promise<Documento[]> {
    return this.documentoRepo.find({
      where: { proyectoId },
      relations: { versiones: true },
      order: { creadoEn: 'DESC' },
    });
  }

  async obtenerConVersiones(documentoId: string): Promise<Documento> {
    const doc = await this.documentoRepo.findOne({
      where: { id: documentoId },
      relations: { versiones: { createdByUser: true }, jornada: true },
      order: { versiones: { versionNumber: 'ASC' } },
    });
    if (!doc) {
      throw new NotFoundException(`Documento ${documentoId} no encontrado`);
    }
    if (doc.versiones?.length) {
      doc.versiones.sort((a, b) => a.versionNumber - b.versionNumber);
    }
    return doc;
  }

  async compararVersiones(
    documentoId: string,
    versionAId: string,
    versionBId: string,
  ) {
    const doc = await this.obtenerConVersiones(documentoId);
    const a = doc.versiones.find((v) => v.id === versionAId);
    const b = doc.versiones.find((v) => v.id === versionBId);
    if (!a || !b) {
      throw new NotFoundException('Una o ambas versiones no existen');
    }

    const camposA = this.camposParaComparar(a.snapshot);
    const camposB = this.camposParaComparar(b.snapshot);
    const porClaveA = new Map(camposA.map((c) => [c.clave, c]));
    const porClaveB = new Map(camposB.map((c) => [c.clave, c]));
    const claves = new Set([...porClaveA.keys(), ...porClaveB.keys()]);

    const campos = [...claves].map((clave) => {
      const ca = porClaveA.get(clave);
      const cb = porClaveB.get(clave);
      return {
        clave,
        etiqueta: cb?.etiqueta ?? ca?.etiqueta ?? clave,
        tipo: cb?.tipo ?? ca?.tipo ?? 'TEXTO',
        versionAnterior: ca?.valor ?? null,
        versionNueva: cb?.valor ?? null,
        cambio: !this.valoresEquivalentes(ca?.valor, cb?.valor),
      };
    });

    return {
      documentoId,
      titulo: doc.titulo,
      versionA: {
        id: a.id,
        versionNumber: a.versionNumber,
        status: a.status,
        createdAt: a.createdAt,
        changeReason: a.changeReason,
      },
      versionB: {
        id: b.id,
        versionNumber: b.versionNumber,
        status: b.status,
        createdAt: b.createdAt,
        changeReason: b.changeReason,
      },
      campos,
    };
  }

  async generarOVersionar(
    jornadaId: string,
    usuario: Usuario,
    opciones: { changeReason?: string; forzarNuevaVersion?: boolean } = {},
  ): Promise<{ documento: Documento; version: DocumentoVersion }> {
    const jornada = await this.jornadaRepo.findOne({
      where: { id: jornadaId },
      relations: { proyecto: true, meta: true, tecnicoResponsable: true },
    });
    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }

    const tipo =
      jornada.tipo === TipoJornada.GRUPAL
        ? TipoDocumento.ACTA_ASISTENCIA
        : TipoDocumento.REPORTE_FORMULARIO;

    let documento = await this.documentoRepo.findOne({
      where: { jornadaId, tipo },
    });

    if (!documento) {
      documento = await this.documentoRepo.save(
        this.documentoRepo.create({
          proyectoId: jornada.proyecto.id,
          jornadaId: jornada.id,
          tipo,
          titulo:
            jornada.tipo === TipoJornada.GRUPAL
              ? 'Acta de asistencia'
              : 'Reporte de formulario',
          plantillaId: null,
          versionVigenteId: null,
          estadoFuncional: EstadoFuncional.BORRADOR,
        }),
      );
    }

    const ultima = await this.versionRepo.findOne({
      where: { documentId: documento.id },
      order: { versionNumber: 'DESC' },
    });

    const crearNueva =
      opciones.forzarNuevaVersion ||
      !ultima ||
      ultima.status === EstadoVersionDocumento.RECHAZADO ||
      ultima.status === EstadoVersionDocumento.APROBADO;

    if (!crearNueva && ultima) {
      return { documento, version: ultima };
    }

    const pdfBuffer =
      jornada.tipo === TipoJornada.GRUPAL
        ? await this.jornadasService.generarPdfAsistencia(jornadaId)
        : await this.jornadasService.generarPdfFormulario(jornadaId);

    const filePath = await this.guardarPdf(
      jornada.proyecto.id,
      jornada.id,
      pdfBuffer,
    );

    const versionNumber = (ultima?.versionNumber ?? 0) + 1;
    const status =
      versionNumber === 1
        ? EstadoVersionDocumento.GENERADO
        : EstadoVersionDocumento.CORREGIDO;

    const camposFormulario = await this.capturarCamposFormulario(jornadaId);

    const snapshot = {
      tipoJornada: jornada.tipo,
      fecha: jornada.fecha,
      cantidadEjecutada: jornada.cantidadEjecutada,
      observaciones: jornada.observaciones,
      tecnico: jornada.tecnicoResponsableNombre,
      metaId: jornada.meta?.id ?? null,
      metaNombre: jornada.meta?.nombre ?? null,
      estadoFuncionalJornada: jornada.estadoFuncional,
      versionNumber,
      campos: camposFormulario,
    };

    const version = await this.versionRepo.save(
      this.versionRepo.create({
        documentId: documento.id,
        versionNumber,
        status,
        generatedFromJornadaId: jornada.id,
        templateId: null,
        createdBy: usuario.id,
        changeReason: opciones.changeReason ?? null,
        filePath,
        previousVersionId: ultima?.id ?? null,
        snapshot,
      }),
    );

    // update parcial: evitar save del padre con `versiones` cargadas (borra huérfanas).
    await this.documentoRepo.update(documento.id, {
      versionVigenteId: version.id,
      estadoFuncional: EstadoFuncional.SINCRONIZADO,
    });
    documento.versionVigenteId = version.id;
    documento.estadoFuncional = EstadoFuncional.SINCRONIZADO;

    const cambios = this.resumenCambiosEntreSnapshots(
      ultima?.snapshot ?? null,
      snapshot,
    );

    await this.auditoriaService.registrar({
      entityType: 'DOCUMENTO',
      entityId: documento.id,
      action:
        versionNumber === 1
          ? AccionAuditoria.GENERATE_DOCUMENT
          : AccionAuditoria.CREATE_VERSION,
      user: usuario,
      projectId: jornada.proyecto.id,
      jornadaId: jornada.id,
      documentId: documento.id,
      documentVersionId: version.id,
      reason: opciones.changeReason ?? null,
      newValue: {
        versionNumber,
        status,
        filePath,
        previousVersionId: ultima?.id ?? null,
        cambios,
      },
      previousValue: ultima
        ? {
            versionNumber: ultima.versionNumber,
            status: ultima.status,
            versionId: ultima.id,
          }
        : null,
      source: 'api',
    });

    return { documento, version };
  }

  private async capturarCamposFormulario(
    jornadaId: string,
  ): Promise<CampoSnapshot[]> {
    const envios = await this.envioRepo.find({
      where: { jornada: { id: jornadaId } },
      relations: {
        respuestas: { campoFormulario: true },
        plantillaFormulario: true,
      },
      order: { enviadoEn: 'DESC' },
    });
    if (!envios.length) return [];

    const vistos = new Set<string>();
    const campos: CampoSnapshot[] = [];
    for (const envio of envios) {
      const plantillaId = envio.plantillaFormulario?.id ?? 'sin-plantilla';
      if (vistos.has(plantillaId)) continue;
      vistos.add(plantillaId);

      for (const r of envio.respuestas ?? []) {
        const campo = r.campoFormulario;
        const tipo = String(campo?.tipoCampo ?? 'TEXTO');
        const valor =
          r.valorNumero != null
            ? Number(r.valorNumero)
            : r.valorBooleano != null
              ? r.valorBooleano
              : r.valorFecha != null
                ? r.valorFecha
                : r.valorJson != null
                  ? r.valorJson
                  : (r.urlArchivo ?? r.valorTexto ?? null);

        const claveEstable = campo?.id
          ? `campo:${campo.id}`
          : `${plantillaId}:${r.claveCampo}`;

        campos.push({
          clave: claveEstable,
          etiqueta: campo?.etiqueta ?? r.claveCampo,
          tipo,
          valor,
        });
      }
    }
    return campos;
  }

  /** Campos de formulario + metadatos de jornada para el diff. */
  private camposParaComparar(
    snapshot: Record<string, unknown> | null | undefined,
  ): CampoSnapshot[] {
    const deFormulario = this.extraerCamposSnapshot(snapshot);
    if (!snapshot) return deFormulario;

    const meta: CampoSnapshot[] = [
      {
        clave: '_meta:cantidadEjecutada',
        etiqueta: 'Avance de la meta (unidades)',
        tipo: 'NUMERO',
        valor:
          snapshot.cantidadEjecutada != null
            ? Number(snapshot.cantidadEjecutada)
            : null,
      },
      {
        clave: '_meta:observaciones',
        etiqueta: 'Observaciones de la jornada',
        tipo: 'TEXTO',
        valor: snapshot.observaciones ?? null,
      },
    ];

    return [...meta, ...deFormulario];
  }

  private resumenCambiosEntreSnapshots(
    anterior: Record<string, unknown> | null | undefined,
    nuevo: Record<string, unknown>,
  ): Array<{
    clave: string;
    etiqueta: string;
    tipo: string;
    anterior: unknown;
    nuevo: unknown;
  }> {
    const a = this.camposParaComparar(anterior);
    const b = this.camposParaComparar(nuevo);
    const porA = new Map(a.map((c) => [c.clave, c]));
    const porB = new Map(b.map((c) => [c.clave, c]));
    const claves = new Set([...porA.keys(), ...porB.keys()]);
    const cambios: Array<{
      clave: string;
      etiqueta: string;
      tipo: string;
      anterior: unknown;
      nuevo: unknown;
    }> = [];

    for (const clave of claves) {
      const ca = porA.get(clave);
      const cb = porB.get(clave);
      if (this.valoresEquivalentes(ca?.valor, cb?.valor)) continue;
      cambios.push({
        clave,
        etiqueta: cb?.etiqueta ?? ca?.etiqueta ?? clave,
        tipo: cb?.tipo ?? ca?.tipo ?? 'TEXTO',
        anterior: this.compactarValorParaAuditoria(ca?.valor, ca?.tipo),
        nuevo: this.compactarValorParaAuditoria(cb?.valor, cb?.tipo),
      });
    }

    return cambios;
  }

  private compactarValorParaAuditoria(
    valor: unknown,
    tipo?: string,
  ): unknown {
    if (valor == null || valor === '') return null;
    if (
      tipo === 'FIRMA' ||
      (typeof valor === 'string' && /^data:image\//i.test(valor))
    ) {
      return {
        firma: true,
        presente: true,
        bytes: String(valor).length,
      };
    }
    if (
      tipo === 'TABLA' ||
      (valor &&
        typeof valor === 'object' &&
        Array.isArray((valor as { filas?: unknown }).filas))
    ) {
      const filas = (valor as { filas?: Record<string, unknown>[] }).filas ?? [];
      return {
        registros: filas.length,
        filas: filas.map((fila) => {
          const limpia: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(fila ?? {})) {
            if (typeof v === 'string' && /^data:image\//i.test(v)) {
              limpia[k] = { firma: true, presente: true, bytes: v.length };
            } else {
              limpia[k] = v;
            }
          }
          return limpia;
        }),
      };
    }
    return valor;
  }

  private valoresEquivalentes(a: unknown, b: unknown): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return a === b;
    }
  }

  private extraerCamposSnapshot(
    snapshot: Record<string, unknown> | null | undefined,
  ): CampoSnapshot[] {
    if (!snapshot) return [];
    const raw = snapshot.campos;
    if (Array.isArray(raw)) {
      return raw
        .filter(
          (c): c is Record<string, unknown> => !!c && typeof c === 'object',
        )
        .map((c) => ({
          clave: String(c.clave ?? ''),
          etiqueta: String(c.etiqueta ?? c.clave ?? ''),
          tipo: String(c.tipo ?? 'TEXTO'),
          valor: c.valor,
        }))
        .filter((c) => c.clave);
    }

    const ignorar = new Set([
      'tipoJornada',
      'fecha',
      'cantidadEjecutada',
      'observaciones',
      'tecnico',
      'metaId',
      'metaNombre',
      'estadoFuncionalJornada',
      'versionNumber',
      'correccion',
      'beneficiario',
      'campos',
    ]);
    return Object.entries(snapshot)
      .filter(([k]) => !ignorar.has(k))
      .map(([clave, valor]) => ({
        clave,
        etiqueta: clave.replaceAll('_', ' '),
        tipo:
          typeof valor === 'number'
            ? 'NUMERO'
            : typeof valor === 'boolean'
              ? 'SI_NO'
              : 'TEXTO',
        valor,
      }));
  }

  private async guardarPdf(
    proyectoId: string,
    jornadaId: string,
    buffer: Buffer,
  ): Promise<string> {
    const rutaBase =
      this.configService.get<string>('RUTA_SUBIDAS') ||
      path.join(process.cwd(), 'subidas');
    const directorio = path.join(rutaBase, proyectoId, jornadaId, 'documentos');
    await fs.mkdir(directorio, { recursive: true });
    const nombre = `${randomUUID()}.pdf`;
    const rutaCompleta = path.join(directorio, nombre);
    await fs.writeFile(rutaCompleta, buffer);
    return path
      .join('subidas', proyectoId, jornadaId, 'documentos', nombre)
      .replace(/\\/g, '/');
  }
}
