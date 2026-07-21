import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('eventos_cronologia')
@Index('IDX_eventos_cronologia_actor_ocurrido', ['actorId', 'ocurridoEn'])
@Index('IDX_eventos_cronologia_proyecto_ocurrido', ['proyectoId', 'ocurridoEn'])
export class EventoCronologia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actor_id' })
  actor: Usuario;

  @Column({ name: 'proyecto_id', type: 'uuid' })
  proyectoId: string;

  @ManyToOne(() => Proyecto, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @Column({ type: 'varchar', length: 64 })
  accion: string;

  @Column({ name: 'entidad_tipo', type: 'varchar', length: 64 })
  entidadTipo: string;

  @Column({ name: 'entidad_id', type: 'uuid', nullable: true })
  entidadId: string | null;

  @Column({ type: 'varchar', length: 512 })
  titulo: string;

  @Column({ type: 'jsonb', nullable: true })
  detalle: Record<string, unknown> | null;

  @Column({ name: 'ocurrido_en', type: 'timestamptz' })
  ocurridoEn: Date;
}
