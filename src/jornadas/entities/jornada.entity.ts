import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Meta } from '../../actividades/entities/meta.entity';
import { Beneficiario } from '../../beneficiarios/entities/beneficiario.entity';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { Vereda } from '../../territorios/entities/vereda.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoJornada } from '../enums/estado-jornada.enum';
import { TipoJornada } from '../enums/tipo-jornada.enum';
import { JornadaActividad } from './jornada-actividad.entity';
import { JornadaAsistente } from './jornada-asistente.entity';

@Entity('jornadas')
@Unique('UQ_jornada_dispositivo_id_local', ['dispositivoId', 'idLocal'])
export class Jornada {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({
    type: 'enum',
    enum: EstadoJornada,
    default: EstadoJornada.PLANIFICADA,
  })
  estado: EstadoJornada;

  @Column({
    type: 'enum',
    enum: TipoJornada,
    default: TipoJornada.INDIVIDUAL,
  })
  tipo: TipoJornada;

  /** Nombre de identificación opcional para distinguir jornadas en listados. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  nombre: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({
    name: 'cantidad_ejecutada',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  cantidadEjecutada: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @Column({ name: 'es_offline', default: false })
  esOffline: boolean;

  @Column({ name: 'sincronizado_en', type: 'timestamptz', nullable: true })
  sincronizadoEn: Date;

  @Column({ name: 'id_local', nullable: true })
  idLocal: string;

  @Column({ name: 'dispositivo_id', nullable: true })
  dispositivoId: string;

  @ManyToOne(() => Proyecto, { nullable: false })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @ManyToOne(() => Meta, { nullable: true })
  @JoinColumn({ name: 'meta_id' })
  meta: Meta | null;

  @OneToMany(() => JornadaActividad, (ja) => ja.jornada, { cascade: true })
  jornadaActividades: JornadaActividad[];

  @OneToMany(() => JornadaAsistente, (asistente) => asistente.jornada, {
    cascade: true,
  })
  asistentes: JornadaAsistente[];

  @ManyToOne(() => Vereda, { nullable: false })
  @JoinColumn({ name: 'vereda_id' })
  vereda: Vereda;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'tecnico_responsable_id' })
  tecnicoResponsable: Usuario;

  /** Snapshot del nombre del técnico al crear la jornada. */
  @Column({ name: 'tecnico_responsable_nombre' })
  tecnicoResponsableNombre: string;

  @ManyToMany(() => Beneficiario)
  @JoinTable({
    name: 'jornada_beneficiarios',
    joinColumn: { name: 'jornada_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'beneficiario_id', referencedColumnName: 'id' },
  })
  beneficiarios: Beneficiario[];

  @ManyToMany(() => Usuario)
  @JoinTable({
    name: 'jornada_equipo',
    joinColumn: { name: 'jornada_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
  })
  equipo: Usuario[];
}
