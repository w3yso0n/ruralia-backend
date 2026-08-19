import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlantillaDashboard } from './plantilla-dashboard.entity';
import { TamanoWidgetDashboard } from './widget-dashboard.entity';

/** Un widget dentro del layout de una plantilla de dashboard. */
@Entity('items_plantilla_dashboard')
@Index(['plantilla', 'widgetClave'], { unique: true })
export class ItemPlantillaDashboard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PlantillaDashboard, (plantilla) => plantilla.items, {
    onDelete: 'CASCADE',
  })
  plantilla: PlantillaDashboard;

  @Column({ name: 'widget_clave' })
  widgetClave: string;

  @Column()
  posicion: number;

  @Column({ type: 'enum', enum: TamanoWidgetDashboard })
  tamano: TamanoWidgetDashboard;

  @Column({ default: true })
  visible: boolean;
}
