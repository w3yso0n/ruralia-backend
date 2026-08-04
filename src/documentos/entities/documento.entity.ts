import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoFuncional } from '../../common/workflow/estado-funcional.enum';
import { Jornada } from '../../jornadas/entities/jornada.entity';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { TipoDocumento } from '../enums/tipo-documento.enum';
import { DocumentoVersion } from './documento-version.entity';

@Entity('documents')
export class Documento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'proyecto_id', type: 'uuid' })
  proyectoId: string;

  @ManyToOne(() => Proyecto, { nullable: false })
  @JoinColumn({ name: 'proyecto_id' })
  proyecto: Proyecto;

  @Column({ name: 'jornada_id', type: 'uuid' })
  jornadaId: string;

  @ManyToOne(() => Jornada, { nullable: false })
  @JoinColumn({ name: 'jornada_id' })
  jornada: Jornada;

  @Column({ type: 'enum', enum: TipoDocumento })
  tipo: TipoDocumento;

  @Column({ type: 'varchar', length: 300 })
  titulo: string;

  @Column({ name: 'plantilla_id', type: 'uuid', nullable: true })
  plantillaId: string | null;

  @Column({ name: 'version_vigente_id', type: 'uuid', nullable: true })
  versionVigenteId: string | null;

  @Column({
    name: 'estado_funcional',
    type: 'enum',
    enum: EstadoFuncional,
    default: EstadoFuncional.BORRADOR,
  })
  estadoFuncional: EstadoFuncional;

  @OneToMany(() => DocumentoVersion, (v) => v.documento, {
    // Historial append-only: nunca propagar remove desde el padre.
    cascade: false,
  })
  versiones: DocumentoVersion[];

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
