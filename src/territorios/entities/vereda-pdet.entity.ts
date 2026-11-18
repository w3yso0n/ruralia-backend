import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Municipio } from './municipio.entity';
import { Vereda } from './vereda.entity';

/**
 * Vereda según la división PDET (zonas de posconflicto). Es un catálogo
 * aparte del DANE: una vereda DANE puede corresponder a varias PDET o a
 * ninguna. El departamento se obtiene por el municipio.
 */
@Entity('veredas_pdet')
@Unique('UQ_veredas_pdet_municipio_codigo', ['municipio', 'codigo'])
@Index('IDX_veredas_pdet_municipio_id', ['municipio'])
@Index('IDX_veredas_pdet_vereda_dane_id', ['veredaDane'])
export class VeredaPdet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  /** Código del archivo PDET. Único dentro del municipio. */
  @Column({ type: 'varchar', length: 60 })
  codigo: string;

  /** Subregión PDET (p. ej. "Montes de María"), si el archivo la trae. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  subregion: string | null;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Municipio, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'municipio_id' })
  municipio: Municipio;

  /** Vereda DANE equivalente, cuando existe una correspondencia clara. */
  @ManyToOne(() => Vereda, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vereda_dane_id' })
  veredaDane: Vereda | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
