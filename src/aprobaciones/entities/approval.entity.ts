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

@Entity('approvals')
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_type', type: 'enum', enum: EntidadRevisable })
  entityType: EntidadRevisable;

  @Index('IDX_approvals_entity_id')
  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'jornada_id', type: 'uuid', nullable: true })
  jornadaId: string | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ name: 'document_version_id', type: 'uuid', nullable: true })
  documentVersionId: string | null;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser: Usuario;

  @Column({ name: 'approved_by' })
  approvedBy: string;

  @CreateDateColumn({ name: 'approved_at', type: 'timestamptz' })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
