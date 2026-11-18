import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LineaProductiva } from '../../lineas-productivas/entities/linea-productiva.entity';
import { ProyectoBeneficiario } from '../../proyectos/entities/proyecto-beneficiario.entity';
import { Vereda } from '../../territorios/entities/vereda.entity';
import { Genero } from '../enums/genero.enum';
import { TipoDocumento } from '../enums/tipo-documento.enum';
import type { DatosAdicionales } from './campo-beneficiario.entity';
import type {
  FuenteUbicacion,
  OrigenGps,
} from '../utils/ubicacion-beneficiario';

@Entity('beneficiarios')
@Index('IDX_beneficiarios_linea_productiva_id', ['lineaProductivaId'])
export class Beneficiario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombres: string;

  @Column()
  apellidos: string;

  @Column({ name: 'primer_nombre', type: 'varchar', nullable: true })
  primerNombre: string | null;

  @Column({ name: 'segundo_nombre', type: 'varchar', nullable: true })
  segundoNombre: string | null;

  @Column({ name: 'primer_apellido', type: 'varchar', nullable: true })
  primerApellido: string | null;

  @Column({ name: 'segundo_apellido', type: 'varchar', nullable: true })
  segundoApellido: string | null;

  @Column({ name: 'tipo_documento', type: 'enum', enum: TipoDocumento })
  tipoDocumento: TipoDocumento;

  @Column({ name: 'numero_documento', unique: true })
  numeroDocumento: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  correo: string;

  @Column({ type: 'enum', enum: Genero, nullable: true })
  genero: Genero | null;

  @Column({ type: 'int', nullable: true })
  edad: number | null;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ type: 'varchar', nullable: true })
  municipio: string | null;

  /**
   * Texto original de la línea productiva. Se conserva tal cual mientras el
   * catálogo nuevo se valida; cada escritura nueva lo mantiene igual al nombre
   * de `lineaProductivaCatalogo`.
   */
  @Column({ name: 'linea_productiva', type: 'varchar', nullable: true })
  lineaProductiva: string | null;

  @Column({ name: 'linea_productiva_id', type: 'uuid', nullable: true })
  lineaProductivaId: string | null;

  @ManyToOne(() => LineaProductiva, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linea_productiva_id' })
  lineaProductivaCatalogo?: LineaProductiva | null;

  @Column({ name: 'nombre_asociacion', type: 'varchar', nullable: true })
  nombreAsociacion: string | null;

  /**
   * Ubicación propia del beneficiario (su predio), en grados decimales WGS84.
   * No es la ubicación de la vereda: esa vive en `vereda.latitud/longitud`.
   * Latitud y longitud se guardan siempre juntas (ambas o ninguna).
   */
  @Column({ type: 'double precision', nullable: true })
  latitud: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitud: number | null;

  /** Altitud del predio en metros sobre el nivel del mar. */
  @Column({ type: 'double precision', nullable: true })
  altitud: number | null;

  /**
   * De dónde salió la ubicación. GPS (campo GPS de un formulario) es la fuente
   * de mayor confianza: ni el Excel la reemplaza. Ver `utils/ubicacion-beneficiario.ts`.
   */
  @Column({ name: 'ubicacion_fuente', type: 'varchar', length: 20, nullable: true })
  ubicacionFuente: FuenteUbicacion | null;

  /** Solo con fuente GPS: lectura en vivo o última posición que tenía el teléfono. */
  @Column({ name: 'ubicacion_origen_gps', type: 'varchar', length: 20, nullable: true })
  ubicacionOrigenGps: OrigenGps | null;

  /** Solo con fuente GPS: precisión reportada por el teléfono, en metros. */
  @Column({ name: 'ubicacion_precision_m', type: 'double precision', nullable: true })
  ubicacionPrecisionMetros: number | null;

  /** Momento de la captura (GPS) o de la carga/edición. */
  @Column({ name: 'ubicacion_capturada_en', type: 'timestamptz', nullable: true })
  ubicacionCapturadaEn: Date | null;

  /** Envío de formulario que aportó el GPS, para trazabilidad. */
  @Column({ name: 'ubicacion_envio_id', type: 'uuid', nullable: true })
  ubicacionEnvioId: string | null;

  /** Una persona revisó la ubicación y la dio por buena. Se limpia si cambia. */
  @Column({ name: 'ubicacion_confirmada_en', type: 'timestamptz', nullable: true })
  ubicacionConfirmadaEn: Date | null;

  @Column({ name: 'ubicacion_confirmada_por_id', type: 'uuid', nullable: true })
  ubicacionConfirmadaPorId: string | null;

  /** Columnas del Excel del catálogo que no existen en el modelo. Etiquetas en `campos_beneficiario` (proyecto nulo). */
  @Column({
    name: 'datos_adicionales',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  datosAdicionales: DatosAdicionales;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  /**
   * Eliminación definitiva (no reversible desde la plataforma). El registro se
   * conserva solo para no romper el historial de proyectos y jornadas; siempre
   * va acompañado de `estaActivo = false`, así que los filtros por activos ya lo excluyen.
   */
  @Column({ name: 'eliminado_en', type: 'timestamptz', nullable: true })
  eliminadoEn: Date | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @OneToMany(() => ProyectoBeneficiario, (pb) => pb.beneficiario)
  proyectoBeneficiarios: ProyectoBeneficiario[];

  @ManyToOne(() => Vereda, { nullable: true })
  @JoinColumn({ name: 'vereda_id' })
  vereda: Vereda | null;
}
