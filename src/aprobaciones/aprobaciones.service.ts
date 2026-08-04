import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccionAuditoria } from '../common/workflow/accion-auditoria.enum';
import { EntidadRevisable } from '../common/workflow/entidad-revisable.enum';
import { EstadoFuncional } from '../common/workflow/estado-funcional.enum';
import {
  estadoEditable,
  transicionarEstado,
} from '../common/workflow/maquina-estados';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CronologiaService } from '../cronologia/cronologia.service';
import { DocumentosService } from '../documentos/documentos.service';
import { EstadoVersionDocumento } from '../documentos/enums/estado-version-documento.enum';
import { Documento } from '../documentos/entities/documento.entity';
import { DocumentoVersion } from '../documentos/entities/documento-version.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { RolSistema } from '../usuarios/catalogo-permisos';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { usuarioTieneAccesoTotal } from '../usuarios/utils/permisos-usuario';
import {
  AprobarDto,
  FiltrosBandejaDto,
  RechazarDto,
  ReenviarRevisionDto,
} from './dto/aprobaciones.dto';
import { Approval } from './entities/approval.entity';
import {
  EstadoRechazo,
  Rejection,
} from './entities/rejection.entity';

const ROLES_APROBADORES: RolSistema[] = [
  RolSistema.COORDINADOR_ZONA,
  RolSistema.COORDINADOR_DEPARTAMENTAL,
  RolSistema.ADMINISTRADOR,
  RolSistema.CUANTIVA,
];

@Injectable()
export class AprobacionesService {
  constructor(
    @InjectRepository(Jornada)
    private readonly jornadaRepo: Repository<Jornada>,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepo: Repository<Evidencia>,
    @InjectRepository(Documento)
    private readonly documentoRepo: Repository<Documento>,
    @InjectRepository(DocumentoVersion)
    private readonly versionRepo: Repository<DocumentoVersion>,
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
    @InjectRepository(Rejection)
    private readonly rejectionRepo: Repository<Rejection>,
    private readonly auditoriaService: AuditoriaService,
    private readonly documentosService: DocumentosService,
    private readonly cronologiaService: CronologiaService,
  ) {}

  private nombresRol(usuario: Usuario): string[] {
    return (usuario.roles ?? []).map((r) => r.nombre);
  }

  private esAprobador(usuario: Usuario): boolean {
    if (usuarioTieneAccesoTotal(usuario)) return true;
    return this.nombresRol(usuario).some((n) =>
      ROLES_APROBADORES.includes(n as RolSistema),
    );
  }

  private esCampo(usuario: Usuario): boolean {
    const roles = this.nombresRol(usuario);
    return (
      roles.includes(RolSistema.CAMPO) &&
      !roles.some((n) => ROLES_APROBADORES.includes(n as RolSistema)) &&
      !usuarioTieneAccesoTotal(usuario)
    );
  }

  async enviarARevision(jornadaId: string, usuario: Usuario, notas?: string) {
    const jornada = await this.cargarJornada(jornadaId);

    if (
      this.esCampo(usuario) &&
      jornada.tecnicoResponsable?.id !== usuario.id &&
      !(jornada.equipo ?? []).some((u) => u.id === usuario.id)
    ) {
      throw new ForbiddenException(
        'Solo el técnico responsable o equipo puede enviar a revisión',
      );
    }

    const anterior = jornada.estadoFuncional;
    jornada.estadoFuncional = transicionarEstado(
      anterior,
      EstadoFuncional.EN_REVISION,
      { permitirAtajosOnline: true },
    );
    await this.jornadaRepo.save(jornada);

    const { documento, version } =
      await this.documentosService.generarOVersionar(jornadaId, usuario, {
        changeReason: notas,
      });

    documento.estadoFuncional = EstadoFuncional.EN_REVISION;
    await this.documentoRepo.save(documento);

    await this.auditoriaService.registrar({
      entityType: EntidadRevisable.JORNADA,
      entityId: jornada.id,
      field: 'estadoFuncional',
      previousValue: anterior,
      newValue: jornada.estadoFuncional,
      reason: notas ?? 'Envío a revisión',
      action: AccionAuditoria.SUBMIT_FOR_REVIEW,
      user: usuario,
      projectId: jornada.proyecto.id,
      jornadaId: jornada.id,
      documentId: documento.id,
      documentVersionId: version.id,
    });

    await this.cronologiaService.registrar({
      actorId: usuario.id,
      proyectoId: jornada.proyecto.id,
      accion: 'JORNADA_ENVIADA_REVISION',
      entidadTipo: 'jornada',
      entidadId: jornada.id,
      titulo: 'Envió jornada a revisión',
      detalle: {
        origen: 'api',
        documentoId: documento.id,
        versionId: version.id,
      },
    });

    return {
      jornadaId: jornada.id,
      estadoFuncional: jornada.estadoFuncional,
      documentoId: documento.id,
      versionId: version.id,
      versionNumber: version.versionNumber,
    };
  }

  async reenviarARevision(
    jornadaId: string,
    usuario: Usuario,
    dto: ReenviarRevisionDto,
  ) {
    const jornada = await this.cargarJornada(jornadaId);

    if (
      jornada.estadoFuncional !== EstadoFuncional.RECHAZADO &&
      jornada.estadoFuncional !== EstadoFuncional.EN_CORRECCION
    ) {
      throw new BadRequestException(
        'Solo se puede reenviar una jornada rechazada o en corrección',
      );
    }

    if (jornada.estadoFuncional === EstadoFuncional.RECHAZADO) {
      jornada.estadoFuncional = transicionarEstado(
        EstadoFuncional.RECHAZADO,
        EstadoFuncional.EN_CORRECCION,
      );
      await this.jornadaRepo.save(jornada);
    }

    const { documento, version } =
      await this.documentosService.generarOVersionar(jornadaId, usuario, {
        changeReason: dto.changeReason,
        forzarNuevaVersion: true,
      });

    const anterior = jornada.estadoFuncional;
    jornada.estadoFuncional = transicionarEstado(
      EstadoFuncional.EN_CORRECCION,
      EstadoFuncional.EN_REVISION,
    );
    await this.jornadaRepo.save(jornada);

    documento.estadoFuncional = EstadoFuncional.EN_REVISION;
    await this.documentoRepo.save(documento);

    const abiertos = await this.rejectionRepo.find({
      where: {
        jornadaId,
        status: EstadoRechazo.OPEN,
        entityType: In([
          EntidadRevisable.JORNADA,
          EntidadRevisable.DOCUMENTO,
        ]),
      },
    });
    for (const r of abiertos) {
      r.status = EstadoRechazo.RESOLVED;
      r.resolvedAt = new Date();
      r.resolvedBy = usuario.id;
      r.resolutionVersionId = version.id;
    }
    if (abiertos.length) {
      await this.rejectionRepo.save(abiertos);
    }

    await this.auditoriaService.registrar({
      entityType: EntidadRevisable.JORNADA,
      entityId: jornada.id,
      field: 'estadoFuncional',
      previousValue: anterior,
      newValue: jornada.estadoFuncional,
      reason: dto.changeReason,
      action: AccionAuditoria.RESUBMIT,
      user: usuario,
      projectId: jornada.proyecto.id,
      jornadaId: jornada.id,
      documentId: documento.id,
      documentVersionId: version.id,
    });

    await this.cronologiaService.registrar({
      actorId: usuario.id,
      proyectoId: jornada.proyecto.id,
      accion: 'JORNADA_REENVIADA_REVISION',
      entidadTipo: 'jornada',
      entidadId: jornada.id,
      titulo: 'Reenvió jornada a revisión tras corrección',
      detalle: {
        origen: 'api',
        versionId: version.id,
        changeReason: dto.changeReason,
      },
    });

    return {
      jornadaId: jornada.id,
      estadoFuncional: jornada.estadoFuncional,
      documentoId: documento.id,
      versionId: version.id,
      versionNumber: version.versionNumber,
    };
  }

  async aprobar(dto: AprobarDto, usuario: Usuario) {
    if (!this.esAprobador(usuario)) {
      throw new ForbiddenException('No tiene permiso para aprobar');
    }
    // Nunca aceptar approvedBy del cliente: se usa usuario autenticado.

    if (dto.entityType === EntidadRevisable.JORNADA) {
      return this.aprobarJornada(dto.entityId, usuario, dto);
    }
    if (dto.entityType === EntidadRevisable.DOCUMENTO) {
      return this.aprobarDocumento(dto.entityId, usuario, dto);
    }
    if (dto.entityType === EntidadRevisable.EVIDENCIA) {
      return this.aprobarEvidencia(dto.entityId, usuario, dto);
    }
    throw new BadRequestException('Tipo de entidad no soportado');
  }

  async rechazar(dto: RechazarDto, usuario: Usuario) {
    if (!this.esAprobador(usuario)) {
      throw new ForbiddenException('No tiene permiso para rechazar');
    }

    if (dto.entityType === EntidadRevisable.JORNADA) {
      return this.rechazarJornada(dto, usuario);
    }
    if (dto.entityType === EntidadRevisable.DOCUMENTO) {
      return this.rechazarDocumento(dto, usuario);
    }
    if (dto.entityType === EntidadRevisable.EVIDENCIA) {
      return this.rechazarEvidencia(dto, usuario);
    }
    throw new BadRequestException('Tipo de entidad no soportado');
  }

  private async aprobarJornada(
    jornadaId: string,
    usuario: Usuario,
    dto: AprobarDto,
  ) {
    const jornada = await this.cargarJornada(jornadaId);
    this.bloquearAutoAprobacion(jornada, usuario);

    const evidenciasAbiertas = await this.rejectionRepo.count({
      where: {
        jornadaId,
        entityType: EntidadRevisable.EVIDENCIA,
        status: EstadoRechazo.OPEN,
      },
    });
    if (evidenciasAbiertas > 0) {
      throw new BadRequestException(
        'No se puede aprobar: hay evidencias con rechazo abierto',
      );
    }

    const docs = await this.documentoRepo.find({ where: { jornadaId } });
    let versionId = dto.documentVersionId ?? null;
    let documentId: string | null = null;

    if (docs.length) {
      const doc = docs[0];
      documentId = doc.id;
      const vigente =
        (versionId
          ? await this.versionRepo.findOne({ where: { id: versionId } })
          : null) ??
        (doc.versionVigenteId
          ? await this.versionRepo.findOne({
              where: { id: doc.versionVigenteId },
            })
          : null);
      if (!vigente) {
        throw new BadRequestException('No hay versión de documento para aprobar');
      }
      versionId = vigente.id;
      vigente.status = EstadoVersionDocumento.APROBADO;
      await this.versionRepo.save(vigente);
      doc.estadoFuncional = EstadoFuncional.APROBADO;
      await this.documentoRepo.save(doc);
    }

    const anterior = jornada.estadoFuncional;
    jornada.estadoFuncional = transicionarEstado(
      anterior,
      EstadoFuncional.APROBADO,
      { permitirAtajosOnline: false },
    );
    await this.jornadaRepo.save(jornada);

    const approval = await this.approvalRepo.save(
      this.approvalRepo.create({
        entityType: EntidadRevisable.JORNADA,
        entityId: jornada.id,
        projectId: jornada.proyecto.id,
        jornadaId: jornada.id,
        documentId,
        documentVersionId: versionId,
        approvedBy: usuario.id,
        notes: dto.notes ?? null,
      }),
    );

    await this.auditoriaService.registrar({
      entityType: EntidadRevisable.JORNADA,
      entityId: jornada.id,
      field: 'estadoFuncional',
      previousValue: anterior,
      newValue: EstadoFuncional.APROBADO,
      reason: dto.notes ?? 'Aprobación',
      action: AccionAuditoria.APPROVE,
      user: usuario,
      projectId: jornada.proyecto.id,
      jornadaId: jornada.id,
      documentId,
      documentVersionId: versionId,
    });

    await this.cronologiaService.registrar({
      actorId: usuario.id,
      proyectoId: jornada.proyecto.id,
      accion: 'JORNADA_APROBADA',
      entidadTipo: 'jornada',
      entidadId: jornada.id,
      titulo: 'Aprobó la jornada',
      detalle: {
        origen: 'api',
        approvalId: approval.id,
        documentVersionId: versionId,
      },
    });

    return { approval, estadoFuncional: jornada.estadoFuncional };
  }

  private async aprobarDocumento(
    documentoId: string,
    usuario: Usuario,
    dto: AprobarDto,
  ) {
    const doc = await this.documentoRepo.findOne({
      where: { id: documentoId },
      relations: { jornada: { proyecto: true, tecnicoResponsable: true } },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    this.bloquearAutoAprobacion(doc.jornada, usuario);

    const version =
      (dto.documentVersionId
        ? await this.versionRepo.findOne({
            where: { id: dto.documentVersionId },
          })
        : null) ??
      (doc.versionVigenteId
        ? await this.versionRepo.findOne({
            where: { id: doc.versionVigenteId },
          })
        : null);
    if (!version) {
      throw new BadRequestException('Versión de documento no encontrada');
    }

    const anterior = doc.estadoFuncional;
    doc.estadoFuncional = EstadoFuncional.APROBADO;
    version.status = EstadoVersionDocumento.APROBADO;
    await this.versionRepo.save(version);
    await this.documentoRepo.save(doc);

    const approval = await this.approvalRepo.save(
      this.approvalRepo.create({
        entityType: EntidadRevisable.DOCUMENTO,
        entityId: doc.id,
        projectId: doc.proyectoId,
        jornadaId: doc.jornadaId,
        documentId: doc.id,
        documentVersionId: version.id,
        approvedBy: usuario.id,
        notes: dto.notes ?? null,
      }),
    );

    await this.auditoriaService.registrar({
      entityType: EntidadRevisable.DOCUMENTO,
      entityId: doc.id,
      field: 'estadoFuncional',
      previousValue: anterior,
      newValue: EstadoFuncional.APROBADO,
      reason: dto.notes ?? 'Aprobación de documento',
      action: AccionAuditoria.APPROVE,
      user: usuario,
      projectId: doc.proyectoId,
      jornadaId: doc.jornadaId,
      documentId: doc.id,
      documentVersionId: version.id,
    });

    return { approval, estadoFuncional: doc.estadoFuncional, versionId: version.id };
  }

  private async aprobarEvidencia(
    evidenciaId: string,
    usuario: Usuario,
    dto: AprobarDto,
  ) {
    const evidencia = await this.evidenciaRepo.findOne({
      where: { id: evidenciaId },
      relations: { jornada: { proyecto: true, tecnicoResponsable: true } },
    });
    if (!evidencia) throw new NotFoundException('Evidencia no encontrada');
    this.bloquearAutoAprobacion(evidencia.jornada, usuario);

    const anterior = evidencia.estadoFuncional;
    evidencia.estadoFuncional = EstadoFuncional.APROBADO;
    await this.evidenciaRepo.save(evidencia);

    const approval = await this.approvalRepo.save(
      this.approvalRepo.create({
        entityType: EntidadRevisable.EVIDENCIA,
        entityId: evidencia.id,
        projectId: evidencia.jornada.proyecto.id,
        jornadaId: evidencia.jornada.id,
        approvedBy: usuario.id,
        notes: dto.notes ?? null,
      }),
    );

    await this.auditoriaService.registrar({
      entityType: EntidadRevisable.EVIDENCIA,
      entityId: evidencia.id,
      field: 'estadoFuncional',
      previousValue: anterior,
      newValue: EstadoFuncional.APROBADO,
      reason: dto.notes ?? 'Aprobación de evidencia',
      action: AccionAuditoria.APPROVE,
      user: usuario,
      projectId: evidencia.jornada.proyecto.id,
      jornadaId: evidencia.jornada.id,
    });

    return { approval, estadoFuncional: evidencia.estadoFuncional };
  }

  private async rechazarJornada(dto: RechazarDto, usuario: Usuario) {
    const jornada = await this.cargarJornada(dto.entityId);
    const anterior = jornada.estadoFuncional;
    jornada.estadoFuncional = transicionarEstado(
      anterior,
      EstadoFuncional.RECHAZADO,
    );
    await this.jornadaRepo.save(jornada);

    const docs = await this.documentoRepo.find({
      where: { jornadaId: jornada.id },
    });
    for (const doc of docs) {
      doc.estadoFuncional = EstadoFuncional.RECHAZADO;
      if (doc.versionVigenteId) {
        await this.versionRepo.update(doc.versionVigenteId, {
          status: EstadoVersionDocumento.RECHAZADO,
        });
      }
    }
    if (docs.length) await this.documentoRepo.save(docs);

    const rejection = await this.rejectionRepo.save(
      this.rejectionRepo.create({
        entityType: EntidadRevisable.JORNADA,
        entityId: jornada.id,
        projectId: jornada.proyecto.id,
        jornadaId: jornada.id,
        documentId: docs[0]?.id ?? null,
        rejectedBy: usuario.id,
        category: dto.category,
        reason: dto.reason,
        requestedCorrection: dto.requestedCorrection,
        status: EstadoRechazo.OPEN,
      }),
    );

    await this.auditoriaService.registrar({
      entityType: EntidadRevisable.JORNADA,
      entityId: jornada.id,
      field: 'estadoFuncional',
      previousValue: anterior,
      newValue: EstadoFuncional.RECHAZADO,
      reason: dto.reason,
      action: AccionAuditoria.REJECT,
      user: usuario,
      projectId: jornada.proyecto.id,
      jornadaId: jornada.id,
    });

    await this.cronologiaService.registrar({
      actorId: usuario.id,
      proyectoId: jornada.proyecto.id,
      accion: 'JORNADA_RECHAZADA',
      entidadTipo: 'jornada',
      entidadId: jornada.id,
      titulo: 'Rechazó la jornada',
      detalle: {
        origen: 'api',
        category: dto.category,
        requestedCorrection: dto.requestedCorrection,
        rejectionId: rejection.id,
      },
    });

    return { rejection, estadoFuncional: jornada.estadoFuncional };
  }

  private async rechazarDocumento(dto: RechazarDto, usuario: Usuario) {
    const doc = await this.documentoRepo.findOne({
      where: { id: dto.entityId },
      relations: { jornada: { proyecto: true } },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    const anterior = doc.estadoFuncional;
    doc.estadoFuncional = EstadoFuncional.RECHAZADO;
    if (doc.versionVigenteId) {
      await this.versionRepo.update(doc.versionVigenteId, {
        status: EstadoVersionDocumento.RECHAZADO,
      });
    }
    await this.documentoRepo.save(doc);

    const jornada = await this.cargarJornada(doc.jornadaId);
    if (jornada.estadoFuncional === EstadoFuncional.EN_REVISION) {
      jornada.estadoFuncional = EstadoFuncional.EN_CORRECCION;
      await this.jornadaRepo.save(jornada);
    }

    const rejection = await this.rejectionRepo.save(
      this.rejectionRepo.create({
        entityType: EntidadRevisable.DOCUMENTO,
        entityId: doc.id,
        projectId: doc.proyectoId,
        jornadaId: doc.jornadaId,
        documentId: doc.id,
        rejectedBy: usuario.id,
        category: dto.category,
        reason: dto.reason,
        requestedCorrection: dto.requestedCorrection,
        status: EstadoRechazo.OPEN,
      }),
    );

    await this.auditoriaService.registrar({
      entityType: EntidadRevisable.DOCUMENTO,
      entityId: doc.id,
      field: 'estadoFuncional',
      previousValue: anterior,
      newValue: EstadoFuncional.RECHAZADO,
      reason: dto.reason,
      action: AccionAuditoria.REJECT,
      user: usuario,
      projectId: doc.proyectoId,
      jornadaId: doc.jornadaId,
      documentId: doc.id,
    });

    return { rejection, estadoFuncional: doc.estadoFuncional };
  }

  private async rechazarEvidencia(dto: RechazarDto, usuario: Usuario) {
    const evidencia = await this.evidenciaRepo.findOne({
      where: { id: dto.entityId },
      relations: { jornada: { proyecto: true } },
    });
    if (!evidencia) throw new NotFoundException('Evidencia no encontrada');

    const anterior = evidencia.estadoFuncional;
    evidencia.estadoFuncional = EstadoFuncional.RECHAZADO;
    await this.evidenciaRepo.save(evidencia);

    const jornada = evidencia.jornada;
    if (
      jornada.estadoFuncional === EstadoFuncional.EN_REVISION ||
      jornada.estadoFuncional === EstadoFuncional.APROBADO
    ) {
      jornada.estadoFuncional = EstadoFuncional.EN_CORRECCION;
      await this.jornadaRepo.save(jornada);
    }

    const docs = await this.documentoRepo.find({
      where: { jornadaId: jornada.id },
    });
    for (const doc of docs) {
      if (doc.estadoFuncional === EstadoFuncional.EN_REVISION) {
        doc.estadoFuncional = EstadoFuncional.EN_CORRECCION;
      }
    }
    if (docs.length) await this.documentoRepo.save(docs);

    const rejection = await this.rejectionRepo.save(
      this.rejectionRepo.create({
        entityType: EntidadRevisable.EVIDENCIA,
        entityId: evidencia.id,
        projectId: jornada.proyecto.id,
        jornadaId: jornada.id,
        evidenceId: evidencia.id,
        documentId: docs[0]?.id ?? null,
        rejectedBy: usuario.id,
        category: dto.category,
        reason: dto.reason,
        requestedCorrection: dto.requestedCorrection,
        status: EstadoRechazo.OPEN,
      }),
    );

    await this.auditoriaService.registrar({
      entityType: EntidadRevisable.EVIDENCIA,
      entityId: evidencia.id,
      field: 'estadoFuncional',
      previousValue: anterior,
      newValue: EstadoFuncional.RECHAZADO,
      reason: dto.reason,
      action: AccionAuditoria.REJECT,
      user: usuario,
      projectId: jornada.proyecto.id,
      jornadaId: jornada.id,
    });

    return { rejection, estadoFuncional: evidencia.estadoFuncional };
  }

  async bandeja(usuario: Usuario, filtros: FiltrosBandejaDto) {
    const vista =
      filtros.vista ??
      (this.esCampo(usuario)
        ? 'tecnico'
        : this.esAprobador(usuario)
          ? 'supervisor'
          : 'tecnico');

    const qb = this.jornadaRepo
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.proyecto', 'proyecto')
      .leftJoinAndSelect('j.tecnicoResponsable', 'tecnico')
      .leftJoinAndSelect('j.meta', 'meta')
      .leftJoinAndSelect('j.vereda', 'vereda')
      .orderBy('j.creadoEn', 'DESC')
      .take(100);

    if (filtros.proyectoId) {
      qb.andWhere('proyecto.id = :proyectoId', {
        proyectoId: filtros.proyectoId,
      });
    }

    if (vista === 'tecnico') {
      qb.andWhere(
        '(tecnico.id = :uid OR EXISTS (SELECT 1 FROM jornada_equipo je WHERE je.jornada_id = j.id AND je.usuario_id = :uid))',
        { uid: usuario.id },
      );
      if (filtros.estadoFuncional) {
        qb.andWhere('j.estadoFuncional = :ef', {
          ef: filtros.estadoFuncional,
        });
      } else {
        qb.andWhere('j.estadoFuncional IN (:...efs)', {
          efs: [
            EstadoFuncional.BORRADOR,
            EstadoFuncional.CAPTURADO,
            EstadoFuncional.SINCRONIZADO,
            EstadoFuncional.EN_REVISION,
            EstadoFuncional.RECHAZADO,
            EstadoFuncional.EN_CORRECCION,
            EstadoFuncional.APROBADO,
          ],
        });
      }
    } else if (vista === 'supervisor' || vista === 'coordinacion') {
      qb.andWhere('j.estadoFuncional IN (:...efs)', {
        efs: filtros.estadoFuncional
          ? [filtros.estadoFuncional]
          : [
              EstadoFuncional.EN_REVISION,
              EstadoFuncional.RECHAZADO,
              EstadoFuncional.EN_CORRECCION,
              EstadoFuncional.APROBADO,
            ],
      });
    }

    const jornadas = await qb.getMany();
    const ids = jornadas.map((j) => j.id);
    const rechazos = ids.length
      ? await this.rejectionRepo.find({
          where: { jornadaId: In(ids), status: EstadoRechazo.OPEN },
          relations: { rejectedByUser: true },
          order: { rejectedAt: 'DESC' },
        })
      : [];

    const contadores = {
      borradores: 0,
      enRevision: 0,
      rechazadas: 0,
      enCorreccion: 0,
      aprobadas: 0,
      pendientesRevision: 0,
    };
    for (const j of jornadas) {
      if (j.estadoFuncional === EstadoFuncional.BORRADOR) contadores.borradores++;
      if (j.estadoFuncional === EstadoFuncional.EN_REVISION) {
        contadores.enRevision++;
        contadores.pendientesRevision++;
      }
      if (j.estadoFuncional === EstadoFuncional.RECHAZADO) contadores.rechazadas++;
      if (j.estadoFuncional === EstadoFuncional.EN_CORRECCION)
        contadores.enCorreccion++;
      if (j.estadoFuncional === EstadoFuncional.APROBADO) contadores.aprobadas++;
    }

    return {
      vista,
      contadores,
      items: jornadas.map((j) => ({
        id: j.id,
        fecha: j.fecha,
        nombre: j.nombre,
        tipo: j.tipo,
        estado: j.estado,
        estadoFuncional: j.estadoFuncional,
        proyecto: j.proyecto
          ? { id: j.proyecto.id, nombre: j.proyecto.nombre }
          : null,
        tecnicoResponsable: j.tecnicoResponsable
          ? {
              id: j.tecnicoResponsable.id,
              nombre: j.tecnicoResponsable.nombreCompleto,
            }
          : null,
        meta: j.meta ? { id: j.meta.id, nombre: j.meta.nombre } : null,
        vereda: j.vereda ? { id: j.vereda.id, nombre: j.vereda.nombre } : null,
        editable: estadoEditable(j.estadoFuncional),
        rechazosAbiertos: rechazos
          .filter((r) => r.jornadaId === j.id)
          .map((r) => ({
            id: r.id,
            entityType: r.entityType,
            category: r.category,
            reason: r.reason,
            requestedCorrection: r.requestedCorrection,
            rejectedAt: r.rejectedAt,
            rejectedBy: r.rejectedByUser?.nombreCompleto ?? null,
          })),
      })),
    };
  }

  async contadores(usuario: Usuario) {
    const bandeja = await this.bandeja(usuario, {});
    return bandeja.contadores;
  }

  async rechazosDeJornada(jornadaId: string) {
    return this.rejectionRepo.find({
      where: { jornadaId },
      relations: { rejectedByUser: true },
      order: { rejectedAt: 'DESC' },
    });
  }

  async aprobacionesDeJornada(jornadaId: string) {
    return this.approvalRepo.find({
      where: { jornadaId },
      relations: { approvedByUser: true },
      order: { approvedAt: 'DESC' },
    });
  }

  private async cargarJornada(jornadaId: string): Promise<Jornada> {
    const jornada = await this.jornadaRepo.findOne({
      where: { id: jornadaId },
      relations: {
        proyecto: true,
        tecnicoResponsable: true,
        equipo: true,
        meta: true,
      },
    });
    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }
    return jornada;
  }

  private bloquearAutoAprobacion(jornada: Jornada, usuario: Usuario) {
    if (
      this.esCampo(usuario) ||
      (jornada.tecnicoResponsable?.id === usuario.id &&
        !usuarioTieneAccesoTotal(usuario) &&
        !this.nombresRol(usuario).includes(
          RolSistema.COORDINADOR_DEPARTAMENTAL,
        ) &&
        !this.nombresRol(usuario).includes(RolSistema.ADMINISTRADOR))
    ) {
      // Técnico puro no aprueba; coordinador zona sí puede revisar ajenos
      if (this.esCampo(usuario)) {
        throw new ForbiddenException('El técnico no puede autoaprobarse');
      }
      if (
        jornada.tecnicoResponsable?.id === usuario.id &&
        this.nombresRol(usuario).includes(RolSistema.COORDINADOR_ZONA) &&
        !this.nombresRol(usuario).includes(
          RolSistema.COORDINADOR_DEPARTAMENTAL,
        )
      ) {
        throw new ForbiddenException(
          'No puede aprobar una jornada de la que es técnico responsable',
        );
      }
    }
  }
}
