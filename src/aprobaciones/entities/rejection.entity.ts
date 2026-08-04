import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntidadRevisable } from '../../common/workflow/entidad-revisable.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { CategoriaRechazo } from '../enums/categoria-rechazo.enum';

export enum EstadoRechazo {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

@Entity('rejections')
export class Rejection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_type', type: 'enum', enum: EntidadRevisable })
  entityType: EntidadRevisable;

  @Index('IDX_rejections_entity_id')
  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'jornada_id', type: 'uuid', nullable: true })
  jornadaId: string | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ name: 'evidence_id', type: 'uuid', nullable: true })
  evidenceId: string | null;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'rejected_by' })
  rejectedByUser: Usuario;

  @Column({ name: 'rejected_by' })
  rejectedBy: string;

  @CreateDateColumn({ name: 'rejected_at', type: 'timestamptz' })
  rejectedAt: Date;

  @Column({ type: 'enum', enum: CategoriaRechazo })
  category: CategoriaRechazo;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'requested_correction', type: 'text' })
  requestedCorrection: string;

  @Column({
    type: 'enum',
    enum: EstadoRechazo,
    default: EstadoRechazo.OPEN,
  })
  status: EstadoRechazo;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolution_version_id', type: 'uuid', nullable: true })
  resolutionVersionId: string | null;
}
