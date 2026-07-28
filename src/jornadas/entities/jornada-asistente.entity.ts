import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Jornada } from './jornada.entity';

@Entity('jornada_asistentes')
export class JornadaAsistente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Jornada, (jornada) => jornada.asistentes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'jornada_id' })
  jornada: Jornada;

  @Column({ name: 'nombre_completo' })
  nombreCompleto: string;

  @Column({ type: 'varchar', nullable: true })
  documento: string | null;

  /** Firma virtual como data URL (image/png;base64,...). */
  @Column({ name: 'firma_data_url', type: 'text', nullable: true })
  firmaDataUrl: string | null;

  @Column({ name: 'firmado_en', type: 'timestamptz', nullable: true })
  firmadoEn: Date | null;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
