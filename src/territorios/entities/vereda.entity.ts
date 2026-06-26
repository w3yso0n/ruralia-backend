import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Corregimiento } from './corregimiento.entity';

@Entity('veredas')
export class Vereda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  codigo: string;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Corregimiento, (corregimiento) => corregimiento.veredas, {
    nullable: false,
  })
  @JoinColumn({ name: 'corregimiento_id' })
  corregimiento: Corregimiento;
}
