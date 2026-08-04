import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccionAuditoria } from '../../common/workflow/accion-auditoria.enum';

/**
 * Bitácora append-only (RF-18).
 * No hay endpoints de edición/borrado en la API normal.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_audit_logs_entity')
  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  field: string | null;

  @Column({ name: 'previous_value', type: 'jsonb', nullable: true })
  previousValue: unknown | null;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue: unknown | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'enum', enum: AccionAuditoria })
  action: AccionAuditoria;

  @Index('IDX_audit_logs_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'user_role', type: 'varchar', length: 64 })
  userRole: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Index('IDX_audit_logs_project')
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'jornada_id', type: 'uuid', nullable: true })
  jornadaId: string | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ name: 'document_version_id', type: 'uuid', nullable: true })
  documentVersionId: string | null;

  @Column({ name: 'device_id', type: 'varchar', length: 128, nullable: true })
  deviceId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  source: string | null;
}
