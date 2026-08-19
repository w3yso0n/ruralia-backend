import {
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Rol } from '../../usuarios/entities/rol.entity';
import { PlantillaDashboard } from './plantilla-dashboard.entity';

/**
 * Asigna una plantilla de dashboard a un rol. Un rol tiene como máximo una
 * plantilla asignada a la vez (índice único); reasignar reemplaza la fila.
 */
@Entity('asignaciones_plantilla_rol')
@Index(['rol'], { unique: true })
export class AsignacionPlantillaRol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Rol, { onDelete: 'CASCADE' })
  rol: Rol;

  @ManyToOne(() => PlantillaDashboard, { onDelete: 'CASCADE' })
  plantilla: PlantillaDashboard;

  @CreateDateColumn({ name: 'asignado_en' })
  asignadoEn: Date;
}
