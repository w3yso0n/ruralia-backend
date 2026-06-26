import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { Subactividad } from './subactividad.entity';

@Entity('actividades')
export class Actividad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ default: 0 })
  orden: number;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Proyecto, (proyecto) => proyecto.actividades, {
    nullable: false,
  })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @OneToMany(() => Subactividad, (subactividad) => subactividad.actividad)
  subactividades: Subactividad[];
}
