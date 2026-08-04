import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccionAuditoria } from '../common/workflow/accion-auditoria.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  FiltrosAuditoriaDto,
  RespuestaAuditLogDto,
  RespuestaPaginadaAuditoriaDto,
} from './dto/auditoria.dto';
import { AuditLog } from './entities/audit-log.entity';

export interface RegistrarAuditoriaInput {
  entityType: string;
  entityId: string;
  field?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  action: AccionAuditoria;
  user: Usuario;
  projectId: string;
  jornadaId?: string | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  deviceId?: string | null;
  source?: string | null;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /** Registro append-only. Fecha y usuario siempre del servidor/token. */
  async registrar(input: RegistrarAuditoriaInput): Promise<AuditLog> {
    const userRole =
      input.user.roles?.map((r) => r.nombre).join(',') || 'SIN_ROL';

    const fila = this.auditRepo.create({
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field ?? null,
      previousValue:
        input.previousValue === undefined ? null : input.previousValue,
      newValue: input.newValue === undefined ? null : input.newValue,
      reason: input.reason ?? null,
      action: input.action,
      userId: input.user.id,
      userRole,
      projectId: input.projectId,
      jornadaId: input.jornadaId ?? null,
      documentId: input.documentId ?? null,
      documentVersionId: input.documentVersionId ?? null,
      deviceId: input.deviceId ?? null,
      source: input.source ?? 'api',
    });

    return this.auditRepo.save(fila);
  }

  async listar(
    filtros: FiltrosAuditoriaDto,
  ): Promise<RespuestaPaginadaAuditoriaDto> {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 50;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite);

    if (filtros.projectId) {
      qb.andWhere('a.projectId = :projectId', {
        projectId: filtros.projectId,
      });
    }
    if (filtros.jornadaId) {
      qb.andWhere('a.jornadaId = :jornadaId', {
        jornadaId: filtros.jornadaId,
      });
    }
    if (filtros.entityId) {
      qb.andWhere('a.entityId = :entityId', { entityId: filtros.entityId });
    }
    if (filtros.entityType) {
      qb.andWhere('a.entityType = :entityType', {
        entityType: filtros.entityType,
      });
    }
    if (filtros.action) {
      qb.andWhere('a.action = :action', { action: filtros.action });
    }

    const [filas, total] = await qb.getManyAndCount();

    return {
      datos: filas.map((f) => this.aDto(f)),
      total,
      pagina,
      limite,
    };
  }

  private aDto(f: AuditLog): RespuestaAuditLogDto {
    return {
      id: f.id,
      entityType: f.entityType,
      entityId: f.entityId,
      field: f.field,
      previousValue: f.previousValue,
      newValue: f.newValue,
      reason: f.reason,
      action: f.action,
      userId: f.userId,
      userRole: f.userRole,
      createdAt: f.createdAt,
      projectId: f.projectId,
      jornadaId: f.jornadaId,
      documentId: f.documentId,
      documentVersionId: f.documentVersionId,
      source: f.source,
    };
  }
}
