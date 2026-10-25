import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoCampo } from '../enums/tipo-campo.enum';
import { PlantillaFormulario } from './plantilla-formulario.entity';
import { RespuestaFormulario } from './respuesta-formulario.entity';

@Entity('campos_formulario')
export class CampoFormulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  etiqueta: string;

  @Column()
  clave: string;

  @Column({ name: 'tipo_campo', type: 'enum', enum: TipoCampo })
  tipoCampo: TipoCampo;

  @Column({ type: 'jsonb', nullable: true })
  opciones: Record<string, unknown> | null;

  @Column({ name: 'es_obligatorio', default: false })
  esObligatorio: boolean;

  @Column({ default: 0 })
  orden: number;

  @Column({ name: 'reglas_validacion', type: 'jsonb', nullable: true })
  reglasValidacion: Record<string, unknown> | null;

  /**
   * `{ origen }`: la pregunta se llena sola con ese dato del beneficiario y el
   * técnico no la puede cambiar. Las columnas de una tabla lo llevan en
   * `opciones.columnas[i].autocompletar`.
   */
  @Column({ type: 'jsonb', nullable: true })
  autocompletar: { origen: string } | null;

  @ManyToOne(
    () => PlantillaFormulario,
    (plantilla) => plantilla.campos,
    { nullable: false },
  )
  @JoinColumn({ name: 'plantilla_formulario_id' })
  plantillaFormulario: PlantillaFormulario;

  @OneToMany(() => RespuestaFormulario, (respuesta) => respuesta.campoFormulario)
  respuestas: RespuestaFormulario[];
}
