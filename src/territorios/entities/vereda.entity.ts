import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Corregimiento } from './corregimiento.entity';
import { Municipio } from './municipio.entity';

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

  @Column({
    type: 'double precision',
    nullable: true,
  })
  latitud: number | null;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  longitud: number | null;

  @ManyToOne(() => Municipio, (municipio) => municipio.veredas, {
    nullable: false,
  })
  @JoinColumn({ name: 'municipio_id' })
  municipio: Municipio;

  /** Opcional: subdivisiones locales o resoluciones de mapa. */
  @ManyToOne(() => Corregimiento, (corregimiento) => corregimiento.veredas, {
    nullable: true,
  })
  @JoinColumn({ name: 'corregimiento_id' })
  corregimiento: Corregimiento | null;
}
