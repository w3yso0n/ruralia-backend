import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { TamanoWidgetDashboard } from './widget-dashboard.entity';

/**
 * Layout guardado de un widget dentro del dashboard personalizado de un usuario.
 * Un registro por (usuario, widget). Si el usuario nunca configuró nada,
 * el servicio devuelve un layout por defecto sin persistir filas aquí.
 */
@Entity('preferencias_dashboard_usuario')
@Index(['usuario', 'widgetClave'], { unique: true })
export class PreferenciaDashboardUsuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  usuario: Usuario;

  @Column({ name: 'widget_clave' })
  widgetClave: string;

  @Column()
  posicion: number;

  @Column({ type: 'enum', enum: TamanoWidgetDashboard })
  tamano: TamanoWidgetDashboard;

  @Column({ default: true })
  visible: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
