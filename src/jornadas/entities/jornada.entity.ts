import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Actividad } from '../../actividades/entities/actividad.entity';
import { Subactividad } from '../../actividades/entities/subactividad.entity';
import { Beneficiario } from '../../beneficiarios/entities/beneficiario.entity';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { Vereda } from '../../territorios/entities/vereda.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoJornada } from '../enums/estado-jornada.enum';

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

  @Column({ type: 'text', nullable: true })
  observaciones: string;

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

  @ManyToOne(() => Actividad, { nullable: false })
  @JoinColumn({ name: 'actividad_id' })
  actividad: Actividad;

  @ManyToOne(() => Subactividad, { nullable: true })
  @JoinColumn({ name: 'subactividad_id' })
  subactividad: Subactividad;

  @ManyToOne(() => Vereda, { nullable: false })
  @JoinColumn({ name: 'vereda_id' })
  vereda: Vereda;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'tecnico_responsable_id' })
  tecnicoResponsable: Usuario;

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
