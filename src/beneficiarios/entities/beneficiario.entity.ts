import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { Vereda } from '../../territorios/entities/vereda.entity';
import { Genero } from '../enums/genero.enum';
import { TipoDocumento } from '../enums/tipo-documento.enum';

@Entity('beneficiarios')
export class Beneficiario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombres: string;

  @Column()
  apellidos: string;

  @Column({ name: 'tipo_documento', type: 'enum', enum: TipoDocumento })
  tipoDocumento: TipoDocumento;

  @Column({ name: 'numero_documento', unique: true })
  numeroDocumento: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  correo: string;

  @Column({ type: 'enum', enum: Genero, nullable: true })
  genero: Genero;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @ManyToMany(() => Proyecto, (proyecto) => proyecto.beneficiarios)
  proyectos: Proyecto[];

  @ManyToOne(() => Vereda, { nullable: false })
  @JoinColumn({ name: 'vereda_id' })
  vereda: Vereda;
}
