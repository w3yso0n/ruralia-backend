import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Actividad } from '../../actividades/entities/actividad.entity';
import { Subactividad } from '../../actividades/entities/subactividad.entity';
import { EstadoEjecucionJornada } from '../enums/estado-ejecucion-jornada.enum';
import { Jornada } from './jornada.entity';

@Entity('jornada_actividades')
export class JornadaActividad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Jornada, (jornada) => jornada.jornadaActividades, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'jornada_id' })
  jornada: Jornada;

  @ManyToOne(() => Actividad, { nullable: false })
  @JoinColumn({ name: 'actividad_id' })
  actividad: Actividad;

  @ManyToOne(() => Subactividad, { nullable: true })
  @JoinColumn({ name: 'subactividad_id' })
  subactividad?: Subactividad;

  @Column({
    name: 'estado_ejecucion',
    type: 'enum',
    enum: EstadoEjecucionJornada,
    default: EstadoEjecucionJornada.PENDIENTE,
  })
  estadoEjecucion: EstadoEjecucionJornada;

  @Column({ type: 'text', nullable: true })
  nota?: string;

  @Column({ default: 0 })
  orden: number;
}
