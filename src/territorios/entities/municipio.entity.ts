import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Corregimiento } from './corregimiento.entity';
import { Departamento } from './departamento.entity';
import { Vereda } from './vereda.entity';

@Entity('municipios')
export class Municipio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  codigo: string;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Departamento, (departamento) => departamento.municipios, {
    nullable: false,
  })
  @JoinColumn({ name: 'departamento_id' })
  departamento: Departamento;

  @OneToMany(() => Corregimiento, (corregimiento) => corregimiento.municipio)
  corregimientos: Corregimiento[];

  @OneToMany(() => Vereda, (vereda) => vereda.municipio)
  veredas: Vereda[];
}
