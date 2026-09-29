import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Beneficiario } from '../../beneficiarios/entities/beneficiario.entity';
import { ProyectoAsociacion } from '../../proyectos/entities/proyecto-asociacion.entity';
import { Vereda } from '../../territorios/entities/vereda.entity';

@Entity('asociaciones')
export class Asociacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  nit: string;

  @Column({ name: 'nombre_representante' })
  nombreRepresentante: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  correo: string;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;

  @OneToMany(() => ProyectoAsociacion, (pa) => pa.asociacion)
  proyectoAsociaciones: ProyectoAsociacion[];

  @ManyToOne(() => Vereda, { nullable: false })
  @JoinColumn({ name: 'vereda_id' })
  vereda: Vereda;

  /** Beneficiarios agrupados en la asociación; un beneficiario puede pertenecer a varias. */
  @ManyToMany(() => Beneficiario)
  @JoinTable({
    name: 'asociacion_beneficiarios',
    joinColumn: { name: 'asociacion_id' },
    inverseJoinColumn: { name: 'beneficiario_id' },
  })
  beneficiarios: Beneficiario[];
}
