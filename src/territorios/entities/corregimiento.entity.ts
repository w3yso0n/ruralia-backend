import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Municipio } from './municipio.entity';
import { Vereda } from './vereda.entity';

/**
 * Nivel opcional (histórico / Places).
 * El catálogo DANE enlaza vereda directamente con municipio.
 */
@Entity('corregimientos')
export class Corregimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  codigo: string;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Municipio, (municipio) => municipio.corregimientos, {
    nullable: false,
  })
  @JoinColumn({ name: 'municipio_id' })
  municipio: Municipio;

  @OneToMany(() => Vereda, (vereda) => vereda.corregimiento)
  veredas: Vereda[];
}
