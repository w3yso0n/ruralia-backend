import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { FrecuenciaIndicador } from '../enums/frecuencia-indicador.enum';
import { TipoIndicador } from '../enums/tipo-indicador.enum';
import { RegistroIndicador } from './registro-indicador.entity';

@Entity('indicadores')
export class Indicador {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column()
  unidad: string;

  @Column({ name: 'valor_meta', type: 'decimal', nullable: true })
  valorMeta: number;

  @Column({ type: 'enum', enum: TipoIndicador })
  tipo: TipoIndicador;

  @Column({ type: 'enum', enum: FrecuenciaIndicador })
  frecuencia: FrecuenciaIndicador;

  @ManyToMany(() => Proyecto, (proyecto) => proyecto.indicadores)
  @JoinTable({
    name: 'indicador_proyectos',
    joinColumn: { name: 'indicador_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'proyecto_id', referencedColumnName: 'id' },
  })
  proyectos: Proyecto[];

  @OneToMany(() => RegistroIndicador, (registro) => registro.indicador)
  registros: RegistroIndicador[];
}
