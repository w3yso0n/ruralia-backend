import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';

export type TipoCampoBeneficiario = 'texto' | 'numero' | 'fecha' | 'booleano';

export type ValorDatoAdicional = string | number | boolean | null;

export type DatosAdicionales = Record<string, ValorDatoAdicional>;

/**
 * Describe un dato adicional que llegó en una carga masiva y no existe en el
 * modelo del beneficiario. El valor vive en `datos_adicionales` (jsonb) de
 * `proyecto_beneficiarios` (si hay proyecto) o de `beneficiarios` (catálogo).
 */
@Entity('campos_beneficiario')
@Index('IDX_campos_beneficiario_proyecto', ['proyecto'])
export class CampoBeneficiario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nulo: campo del catálogo general (carga desde Contrapartes). */
  @ManyToOne(() => Proyecto, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto | null;

  /** Llave dentro del jsonb: minúsculas, números y guion bajo. */
  @Column({ type: 'varchar', length: 80 })
  clave: string;

  @Column({ type: 'varchar', length: 120 })
  etiqueta: string;

  @Column({ type: 'varchar', length: 20, default: 'texto' })
  tipo: TipoCampoBeneficiario;

  @Column({ type: 'int', default: 0 })
  orden: number;

  /** Encabezado del Excel del que salió; sirve para reconocerlo en la siguiente carga. */
  @Column({
    name: 'columna_origen',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  columnaOrigen: string | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
