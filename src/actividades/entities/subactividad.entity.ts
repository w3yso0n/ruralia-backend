import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoAvanceActividad } from '../enums/estado-avance-actividad.enum';
import { Actividad } from './actividad.entity';
import { Proceso } from './proceso.entity';

@Entity('subactividades')
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

  @OneToMany(() => Proceso, (proceso) => proceso.subactividad)
  procesos: Proceso[];
}
