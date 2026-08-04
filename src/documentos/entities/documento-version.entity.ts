import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoVersionDocumento } from '../enums/estado-version-documento.enum';
import { Documento } from './documento.entity';

@Entity('document_versions')
export class DocumentoVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Documento, (d) => d.versiones, { nullable: false })
  @JoinColumn({ name: 'document_id' })
  documento: Documento;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({
    type: 'enum',
    enum: EstadoVersionDocumento,
    default: EstadoVersionDocumento.GENERADO,
  })
  status: EstadoVersionDocumento;

  @Column({ name: 'generated_from_jornada_id', type: 'uuid' })
  generatedFromJornadaId: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string | null;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdByUser: Usuario;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason: string | null;

  @Column({ name: 'file_path', type: 'varchar', length: 1024, nullable: true })
  filePath: string | null;

  @Column({ name: 'previous_version_id', type: 'uuid', nullable: true })
  previousVersionId: string | null;

  /** Snapshot ligero para comparar versiones sin reabrir PDF. */
  @Column({ type: 'jsonb', nullable: true })
  snapshot: Record<string, unknown> | null;
}
