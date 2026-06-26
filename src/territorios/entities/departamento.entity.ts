import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Municipio } from './municipio.entity';

@Entity('departamentos')
export class Departamento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  codigo: string;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @OneToMany(() => Municipio, (municipio) => municipio.departamento)
  municipios: Municipio[];
}
