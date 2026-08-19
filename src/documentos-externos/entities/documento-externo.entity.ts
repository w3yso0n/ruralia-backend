import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Actividad } from '../../actividades/entities/actividad.entity';
import { Subactividad } from '../../actividades/entities/subactividad.entity';
import { Asociacion } from '../../asociaciones/entities/asociacion.entity';
import { Beneficiario } from '../../beneficiarios/entities/beneficiario.entity';
import { Jornada } from '../../jornadas/entities/jornada.entity';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { Vereda } from '../../territorios/entities/vereda.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { TipoDocumentoExterno } from '../enums/tipo-documento-externo.enum';

/**
 * Documento externo (RF-24): archivo que no se genera dentro de la
 * plataforma (PDF, Word, Excel, escaneo, acta de terceros) pero se vincula
 * al contexto operativo del proyecto para quedar disponible en el
 * expediente y en la auditoría.
 */
@Entity('documentos_externos')
export class DocumentoExterno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'enum', enum: TipoDocumentoExterno })
  tipo: TipoDocumentoExterno;

  @Column({ name: 'nombre_archivo' })
  nombreArchivo: string;

  @Column({ name: 'url_archivo' })
  urlArchivo: string;

  @Column({ name: 'tipo_mime' })
  tipoMime: string;

  @Column({ name: 'tamano_archivo', type: 'bigint' })
  tamanoArchivo: number;

  @Column({ name: 'proyecto_id', type: 'uuid' })
  proyectoId: string;

  @ManyToOne(() => Proyecto, { nullable: false })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @Column({ name: 'actividad_id', type: 'uuid', nullable: true })
  actividadId: string | null;

  @ManyToOne(() => Actividad, { nullable: true })
  @JoinColumn({ name: 'actividad_id' })
  actividad: Actividad | null;

  @Column({ name: 'subactividad_id', type: 'uuid', nullable: true })
  subactividadId: string | null;

  @ManyToOne(() => Subactividad, { nullable: true })
  @JoinColumn({ name: 'subactividad_id' })
  subactividad: Subactividad | null;

  @Column({ name: 'jornada_id', type: 'uuid', nullable: true })
  jornadaId: string | null;

  @ManyToOne(() => Jornada, { nullable: true })
  @JoinColumn({ name: 'jornada_id' })
  jornada: Jornada | null;

  @Column({ name: 'beneficiario_id', type: 'uuid', nullable: true })
  beneficiarioId: string | null;

  @ManyToOne(() => Beneficiario, { nullable: true })
  @JoinColumn({ name: 'beneficiario_id' })
  beneficiario: Beneficiario | null;

  @Column({ name: 'asociacion_id', type: 'uuid', nullable: true })
  asociacionId: string | null;

  @ManyToOne(() => Asociacion, { nullable: true })
  @JoinColumn({ name: 'asociacion_id' })
  asociacion: Asociacion | null;

  @Column({ name: 'vereda_id', type: 'uuid', nullable: true })
  veredaId: string | null;

  @ManyToOne(() => Vereda, { nullable: true })
  @JoinColumn({ name: 'vereda_id' })
  vereda: Vereda | null;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'subido_por_id' })
  subidoPor: Usuario;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
