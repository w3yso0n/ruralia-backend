import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Jornada } from '../../jornadas/entities/jornada.entity';
import { EstadoEvidencia } from '../enums/estado-evidencia.enum';
import { TipoEvidencia } from '../enums/tipo-evidencia.enum';

@Entity('evidencias')
@Unique('UQ_evidencia_dispositivo_id_local', ['dispositivoId', 'idLocal'])
export class Evidencia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoEvidencia })
  tipo: TipoEvidencia;

  @Column({
    type: 'enum',
    enum: EstadoEvidencia,
    default: EstadoEvidencia.PENDIENTE_ARCHIVO,
  })
  estado: EstadoEvidencia;

  @Column({ name: 'url_archivo', nullable: true })
  urlArchivo: string;

  @Column({ name: 'url_miniatura', nullable: true })
  urlMiniatura: string;

  @Column({ name: 'nombre_archivo' })
  nombreArchivo: string;

  @Column({ name: 'tamano_archivo', type: 'bigint', nullable: true })
  tamanoArchivo: number;

  @Column({ name: 'tipo_mime' })
  tipoMime: string;

  @Column({ name: 'capturado_en', type: 'timestamptz' })
  capturadoEn: Date;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number;

  @Column({ name: 'es_offline', default: false })
  esOffline: boolean;

  @Column({ name: 'sincronizado_en', type: 'timestamptz', nullable: true })
  sincronizadoEn: Date;

  @Column({ name: 'id_local', nullable: true })
  idLocal: string;

  @Column({ name: 'dispositivo_id', nullable: true })
  dispositivoId: string;

  @ManyToOne(() => Jornada, { nullable: false })
  @JoinColumn({ name: 'jornada_id' })
  jornada: Jornada;
}
