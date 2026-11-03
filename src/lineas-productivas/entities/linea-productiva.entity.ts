import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Catálogo de líneas productivas (mango, cacao, ñame...). Agrupa a los
 * beneficiarios y orienta a qué beneficiarios atiende una subactividad.
 *
 * `clave` es el nombre normalizado (ver `claveLineaProductiva`): evita que
 * "Mango", "mango " y "MANGO" se registren como líneas distintas.
 */
@Entity('lineas_productivas')
@Index('UQ_lineas_productivas_clave', ['clave'], { unique: true })
export class LineaProductiva {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 120 })
  clave: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
