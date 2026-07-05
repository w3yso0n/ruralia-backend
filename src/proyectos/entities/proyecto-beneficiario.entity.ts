import {
  Column,
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
}
