import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { EstadoPasoRevision } from '../enums/estado-paso-revision.enum';

/**
 * Paso de una jornada. El contenido revisado se identifica con
 * `revisionNumero` (contador de la jornada), no con un document_version_id:
 * una jornada puede tener varios documentos (acta, reporte, informe) y el
 * versionado vive en cada uno.
 */
@Entity('pasos_revision_jornada')
@Unique('UQ_paso_revision_jornada_orden', ['jornadaId', 'orden'])
export class PasoRevisionJornada {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'jornada_id', type: 'uuid' })
  jornadaId: string;

  @Column({ type: 'int' })
  orden: number;

  @Column({ name: 'rol_id', type: 'uuid', nullable: true })
  rolId: string | null;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  @Column({ type: 'enum', enum: EstadoPasoRevision })
  estado: EstadoPasoRevision;

  @Column({ name: 'resuelto_por', type: 'uuid', nullable: true })
  resueltoPor: string | null;

  @Column({ name: 'resuelto_en', type: 'timestamptz', nullable: true })
  resueltoEn: Date | null;

  @Column({ name: 'revision_numero', type: 'int', default: 1 })
  revisionNumero: number;
}
