import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Subactividad } from '../../actividades/entities/subactividad.entity';
import { CampoFormulario } from './campo-formulario.entity';
import { EnvioFormulario } from './envio-formulario.entity';

@Entity('plantillas_formulario')
export class PlantillaFormulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ default: 1 })
  version: number;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Subactividad, { nullable: false })
  @JoinColumn({ name: 'subactividad_id' })
  subactividad: Subactividad;

  @OneToMany(() => CampoFormulario, (campo) => campo.plantillaFormulario)
  campos: CampoFormulario[];

  @OneToMany(() => EnvioFormulario, (envio) => envio.plantillaFormulario)
  envios: EnvioFormulario[];
}
