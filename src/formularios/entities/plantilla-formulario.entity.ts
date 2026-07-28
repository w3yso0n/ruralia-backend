import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proceso } from '../../actividades/entities/proceso.entity';
import { Subactividad } from '../../actividades/entities/subactividad.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { TipoPlantilla } from '../enums/tipo-plantilla.enum';
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

  @Column({
    name: 'tipo_plantilla',
    type: 'enum',
    enum: TipoPlantilla,
    default: TipoPlantilla.INDIVIDUAL,
  })
  tipoPlantilla: TipoPlantilla;

  @ManyToMany(() => Proceso, (proceso) => proceso.plantillasFormulario)
  @JoinTable({
    name: 'plantilla_formulario_procesos',
    joinColumn: { name: 'plantilla_formulario_id' },
    inverseJoinColumn: { name: 'proceso_id' },
  })
  procesos: Proceso[];

  @ManyToMany(() => Subactividad)
  @JoinTable({
    name: 'plantilla_formulario_subactividades',
    joinColumn: { name: 'plantilla_formulario_id' },
    inverseJoinColumn: { name: 'subactividad_id' },
  })
  subactividades: Subactividad[];

  @ManyToMany(() => Usuario)
  @JoinTable({
    name: 'plantilla_formulario_usuarios',
    joinColumn: { name: 'plantilla_formulario_id' },
    inverseJoinColumn: { name: 'usuario_id' },
  })
  usuarios: Usuario[];

  @OneToMany(() => CampoFormulario, (campo) => campo.plantillaFormulario)
  campos: CampoFormulario[];

  @OneToMany(() => EnvioFormulario, (envio) => envio.plantillaFormulario)
  envios: EnvioFormulario[];
}
