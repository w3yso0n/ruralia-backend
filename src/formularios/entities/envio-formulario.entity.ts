import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Jornada } from '../../jornadas/entities/jornada.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { CampoFormulario } from './campo-formulario.entity';
import { PlantillaFormulario } from './plantilla-formulario.entity';
import { RespuestaFormulario } from './respuesta-formulario.entity';

@Entity('envios_formulario')
@Unique('UQ_envio_dispositivo_id_local', ['dispositivoId', 'idLocal'])
export class EnvioFormulario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'enviado_en', type: 'timestamptz' })
  enviadoEn: Date;

  @Column({ name: 'sincronizado_en', type: 'timestamptz', nullable: true })
  sincronizadoEn: Date;

  @Column({ name: 'es_offline', default: false })
  esOffline: boolean;

  @Column({ name: 'datos_raw', type: 'jsonb', nullable: true })
  datosRaw: Record<string, unknown> | null;

  @Column({ name: 'id_local', nullable: true })
  idLocal: string;

  @Column({ name: 'dispositivo_id', nullable: true })
  dispositivoId: string;

  /** Índice de fila para formularios grupales (0 = envío único individual). */
  @Column({ name: 'indice_fila', type: 'int', default: 0 })
  indiceFila: number;

  @ManyToOne(() => Jornada, { nullable: true })
  @JoinColumn({ name: 'jornada_id' })
  jornada: Jornada | null;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(
    () => PlantillaFormulario,
    (plantilla) => plantilla.envios,
    { nullable: false },
  )
  @JoinColumn({ name: 'plantilla_formulario_id' })
  plantillaFormulario: PlantillaFormulario;

  @OneToMany(() => RespuestaFormulario, (respuesta) => respuesta.envioFormulario)
  respuestas: RespuestaFormulario[];
}
