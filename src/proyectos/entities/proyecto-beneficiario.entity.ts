import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Beneficiario } from '../../beneficiarios/entities/beneficiario.entity';
import { Proyecto } from './proyecto.entity';

@Entity('proyecto_beneficiarios')
@Unique('UQ_proyecto_beneficiario', ['proyecto', 'beneficiario'])
export class ProyectoBeneficiario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Proyecto, (proyecto) => proyecto.proyectoBeneficiarios, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @ManyToOne(() => Beneficiario, (beneficiario) => beneficiario.proyectoBeneficiarios, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'beneficiario_id' })
  beneficiario: Beneficiario;

  @Column({ name: 'es_principal', default: false })
  esPrincipal: boolean;

  /** Si es false, salió del cupo activo (reemplazo o baja) pero queda el rastro. */
  @Column({ name: 'esta_activo_en_proyecto', default: true })
  estaActivoEnProyecto: boolean;

  /** Persona a la que este beneficiario sustituye en el proyecto. */
  @ManyToOne(() => Beneficiario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reemplaza_a_id' })
  reemplazaA: Beneficiario | null;

  /** Quién ocupó el cupo de este beneficiario. */
  @ManyToOne(() => Beneficiario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reemplazado_por_id' })
  reemplazadoPor: Beneficiario | null;

  @Column({ name: 'reemplazado_en', type: 'timestamptz', nullable: true })
  reemplazadoEn: Date | null;

  @Column({ name: 'nota_reemplazo', type: 'text', nullable: true })
  notaReemplazo: string | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
