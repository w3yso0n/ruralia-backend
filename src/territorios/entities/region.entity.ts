import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Departamento } from './departamento.entity';

@Entity('regiones')
export class Region {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  codigo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @OneToMany(() => Departamento, (departamento) => departamento.region)
  departamentos: Departamento[];
}
