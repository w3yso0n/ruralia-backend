import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CampoFormulario } from './campo-formulario.entity';
import { EnvioFormulario } from './envio-formulario.entity';

@Entity('respuestas_formulario')
export class RespuestaFormulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'clave_campo' })
  claveCampo: string;

  @Column({ name: 'valor_texto', type: 'text', nullable: true })
  valorTexto: string;

  @Column({ name: 'valor_numero', type: 'decimal', nullable: true })
  valorNumero: number;

  @Column({ name: 'valor_fecha', type: 'timestamptz', nullable: true })
  valorFecha: Date;

  @Column({ name: 'valor_booleano', nullable: true })
  valorBooleano: boolean;

  @Column({ name: 'valor_json', type: 'jsonb', nullable: true })
  valorJson: Record<string, unknown> | null;

  @Column({ name: 'url_archivo', nullable: true })
  urlArchivo: string;

  @ManyToOne(() => EnvioFormulario, (envio) => envio.respuestas, {
    nullable: false,
  })
  @JoinColumn({ name: 'envio_formulario_id' })
  envioFormulario: EnvioFormulario;

  @ManyToOne(() => CampoFormulario, (campo) => campo.respuestas, {
    nullable: false,
  })
  @JoinColumn({ name: 'campo_formulario_id' })
  campoFormulario: CampoFormulario;
}
