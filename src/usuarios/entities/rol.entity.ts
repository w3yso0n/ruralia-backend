import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { NombreRol } from '../enums/nombre-rol.enum';
import { Usuario } from './usuario.entity';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: NombreRol, unique: true })
  nombre: NombreRol;

  @Column({ nullable: true })
  descripcion: string;

  @ManyToMany(() => Usuario, (usuario) => usuario.roles)
  usuarios: Usuario[];
}
