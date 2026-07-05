import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Asociacion } from '../../asociaciones/entities/asociacion.entity';
import { Proyecto } from './proyecto.entity';

@Entity('proyecto_asociaciones')
@Unique('UQ_proyecto_asociacion', ['proyecto', 'asociacion'])
export class ProyectoAsociacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Proyecto, (proyecto) => proyecto.proyectoAsociaciones, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @ManyToOne(() => Asociacion, (asociacion) => asociacion.proyectoAsociaciones, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'asociacion_id' })
  asociacion: Asociacion;

  @Column({ name: 'es_principal', default: false })
  esPrincipal: boolean;
}
