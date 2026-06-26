import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Actividad } from './actividad.entity';

@Entity('subactividades')
export class Subactividad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'text', nullable: true })
  objetivo: string;

  @Column({ default: 0 })
  orden: number;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Actividad, (actividad) => actividad.subactividades, {
    nullable: false,
  })
  @JoinColumn({ name: 'actividad_id' })
  actividad: Actividad;
}
