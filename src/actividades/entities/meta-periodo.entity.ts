import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Meta } from './meta.entity';

@Entity('meta_periodos')
@Unique('UQ_meta_periodo_anio_mes', ['meta', 'anio', 'mes'])
export class MetaPeriodo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Meta, (meta) => meta.periodos, { nullable: false })
  @JoinColumn({ name: 'meta_id' })
  meta: Meta;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'int' })
  mes: number;

  @Column({
    name: 'cantidad_planeada',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  cantidadPlaneada: number;
}
