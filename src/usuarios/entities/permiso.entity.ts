import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Rol } from './rol.entity';

@Entity('permisos')
export class Permiso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  clave: string;

  @Column()
  modulo: string;

  @Column()
  accion: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ default: 0 })
  orden: number;

  @ManyToMany(() => Rol, (rol) => rol.permisos)
  roles: Rol[];
}
