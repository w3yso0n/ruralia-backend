import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { ItemPlantillaDashboard } from './item-plantilla-dashboard.entity';

/**
 * Plantilla de dashboard diseñada por un administrador (o cualquiera con
 * `configuracion.gestionar_plantillas`) y asignable a roles del sistema.
 * Los usuarios sin `configuracion.editar_dashboard` heredan el layout de la
 * plantilla asignada a su rol en vez de un layout propio editable.
 */
@Entity('plantillas_dashboard')
export class PlantillaDashboard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  creadoPor: Usuario | null;

  @OneToMany(() => ItemPlantillaDashboard, (item) => item.plantilla, {
    cascade: true,
  })
  items: ItemPlantillaDashboard[];

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
