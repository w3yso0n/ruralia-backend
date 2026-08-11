import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Meta } from '../../actividades/entities/meta.entity';
import { MetaPeriodo } from '../../actividades/entities/meta-periodo.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('asignaciones_meta')
export class AsignacionMeta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Meta, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meta_id' })
  meta: Meta;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  /** Si es null, la cuota aplica sobre la meta total (no un mes concreto). */
  @ManyToOne(() => MetaPeriodo, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meta_periodo_id' })
  metaPeriodo: MetaPeriodo | null;

  @Column({
    name: 'cantidad_asignada',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  cantidadAsignada: number;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
