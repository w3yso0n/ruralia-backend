import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NivelAccesoRol } from '../enums/nivel-acceso-rol.enum';
import { Permiso } from './permiso.entity';
import { Usuario } from './usuario.entity';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ name: 'es_sistema', default: false })
  esSistema: boolean;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @Column({
    name: 'nivel_acceso',
    type: 'enum',
    enum: NivelAccesoRol,
    default: NivelAccesoRol.PROYECTOS_ASIGNADOS,
  })
  nivelAcceso: NivelAccesoRol;

  @ManyToMany(() => Usuario, (usuario) => usuario.roles)
  usuarios: Usuario[];

  @ManyToMany(() => Permiso, (permiso) => permiso.roles, { eager: false })
  @JoinTable({
    name: 'rol_permisos',
    joinColumn: { name: 'rol_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permiso_id', referencedColumnName: 'id' },
  })
  permisos: Permiso[];
}
