import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Jornada } from '../../jornadas/entities/jornada.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Indicador } from './indicador.entity';

@Entity('registros_indicador')
@Index('IDX_registros_indicador_indicador_id', ['indicador'])
@Index('IDX_registros_indicador_jornada_id', ['jornada'])
export class RegistroIndicador {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal' })
  valor: number;

  @Column({ name: 'registrado_en', type: 'timestamptz' })
  registradoEn: Date;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @ManyToOne(() => Indicador, (indicador) => indicador.registros, {
    nullable: false,
  })
  @JoinColumn({ name: 'indicador_id' })
  indicador: Indicador;

  @ManyToOne(() => Jornada, { nullable: false })
  @JoinColumn({ name: 'jornada_id' })
  jornada: Jornada;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}
