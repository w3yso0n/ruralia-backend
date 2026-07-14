import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proceso } from './proceso.entity';
import { MetaPeriodo } from './meta-periodo.entity';

@Entity('metas')
export class Meta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ name: 'unidad_medida' })
  unidadMedida: string;

  @Column({
    name: 'cantidad_total',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  cantidadTotal: number;

  @Column({ default: 0 })
  orden: number;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Proceso, (proceso) => proceso.metas, { nullable: false })
  @JoinColumn({ name: 'proceso_id' })
  proceso: Proceso;

  @OneToMany(() => MetaPeriodo, (periodo) => periodo.meta)
  periodos: MetaPeriodo[];
}
