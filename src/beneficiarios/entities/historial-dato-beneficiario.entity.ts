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
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Beneficiario } from './beneficiario.entity';

/** De dónde vino el cambio. Hoy solo línea base; queda abierto a otros orígenes. */
export type OrigenCambioBeneficiario = 'LINEA_BASE';

/**
 * Un cambio de un dato del beneficiario: valor anterior y nuevo. Se escribe
 * al aprobar una jornada de línea base con preguntas vinculadas. Los datos
 * son de la persona (no del cupo del proyecto): si alguien reemplaza al
 * beneficiario, el reemplazo tiene su propio historial.
 */
@Entity('historial_datos_beneficiario')
@Index('IDX_historial_datos_beneficiario_beneficiario_id', ['beneficiario'])
@Index('IDX_historial_datos_beneficiario_proyecto_id', ['proyecto'])
@Index('IDX_historial_datos_beneficiario_jornada_id', ['jornadaId'])
export class HistorialDatoBeneficiario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Beneficiario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'beneficiario_id' })
  beneficiario: Beneficiario;

  @ManyToOne(() => Proyecto, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto | null;

  @Column({ name: 'jornada_id', type: 'uuid', nullable: true })
  jornadaId: string | null;

  @Column({ name: 'envio_formulario_id', type: 'uuid', nullable: true })
  envioFormularioId: string | null;

  /** Destino del vínculo, p. ej. `beneficiario.telefono` o `beneficiario.extra.area_finca`. */
  @Column({ type: 'varchar', length: 120 })
  campo: string;

  /** Etiqueta legible al momento del cambio. */
  @Column({ type: 'varchar', length: 200 })
  etiqueta: string;

  @Column({ name: 'valor_anterior', type: 'jsonb', nullable: true })
  valorAnterior: unknown;

  @Column({ name: 'valor_nuevo', type: 'jsonb', nullable: true })
  valorNuevo: unknown;

  @Column({ type: 'varchar', length: 30, default: 'LINEA_BASE' })
  origen: OrigenCambioBeneficiario;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
