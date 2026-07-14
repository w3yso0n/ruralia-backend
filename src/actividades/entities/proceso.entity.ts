import {
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlantillaFormulario } from '../../formularios/entities/plantilla-formulario.entity';
import { Subactividad } from './subactividad.entity';
import { Meta } from './meta.entity';

@Entity('procesos')
export class Proceso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ default: 0 })
  orden: number;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Subactividad, (subactividad) => subactividad.procesos, {
    nullable: false,
  })
  @JoinColumn({ name: 'subactividad_id' })
  subactividad: Subactividad;

  @OneToMany(() => Meta, (meta) => meta.proceso)
  metas: Meta[];

  @ManyToMany(
    () => PlantillaFormulario,
    (plantilla) => plantilla.procesos,
  )
  plantillasFormulario: PlantillaFormulario[];
}
