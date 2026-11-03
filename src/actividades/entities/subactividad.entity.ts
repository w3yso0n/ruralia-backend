import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LineaProductiva } from '../../lineas-productivas/entities/linea-productiva.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoAvanceActividad } from '../enums/estado-avance-actividad.enum';
import { Actividad } from './actividad.entity';
import { Proceso } from './proceso.entity';

@Entity('subactividades')
@Index('IDX_subactividades_actividad_id', ['actividad'])
@Index('IDX_subactividades_linea_productiva_id', ['lineaProductivaId'])
export class Subactividad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'text', nullable: true })
  objetivo: string;

  @Column({ default: 0 })
  orden: number;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @Column({
    name: 'estado_avance',
    type: 'enum',
    enum: EstadoAvanceActividad,
    default: EstadoAvanceActividad.PENDIENTE,
  })
  estadoAvance: EstadoAvanceActividad;

  @Column({ name: 'nota_completado', type: 'text', nullable: true })
  notaCompletado?: string;

  @Column({ name: 'completada_en', type: 'timestamptz', nullable: true })
  completadaEn?: Date;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'completada_por_id' })
  completadaPor?: Usuario;

  @ManyToOne(() => Actividad, (actividad) => actividad.subactividades, {
    nullable: false,
  })
  @JoinColumn({ name: 'actividad_id' })
  actividad: Actividad;

  /** Opcional: orienta a qué beneficiarios se sugieren al crear una jornada. */
  @Column({ name: 'linea_productiva_id', type: 'uuid', nullable: true })
  lineaProductivaId: string | null;

  @ManyToOne(() => LineaProductiva, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linea_productiva_id' })
  lineaProductiva?: LineaProductiva | null;

  @OneToMany(() => Proceso, (proceso) => proceso.subactividad)
  procesos: Proceso[];
}
