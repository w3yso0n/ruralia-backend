import {
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { Vereda } from '../../territorios/entities/vereda.entity';

@Entity('asociaciones')
export class Asociacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  nit: string;

  @Column({ name: 'nombre_representante' })
  nombreRepresentante: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  correo: string;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToMany(() => Proyecto, (proyecto) => proyecto.asociaciones)
  proyectos: Proyecto[];

  @ManyToOne(() => Vereda, { nullable: false })
  @JoinColumn({ name: 'vereda_id' })
  vereda: Vereda;
}
