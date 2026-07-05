import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoAvanceActividad } from '../enums/estado-avance-actividad.enum';
import { Subactividad } from './subactividad.entity';

@Entity('actividades')
export class Actividad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

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

  @ManyToOne(() => Proyecto, (proyecto) => proyecto.actividades, {
    nullable: false,
  })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @OneToMany(() => Subactividad, (subactividad) => subactividad.actividad)
  subactividades: Subactividad[];
}
