import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Actividad } from '../../actividades/entities/actividad.entity';
import { Indicador } from '../../indicadores/entities/indicador.entity';
import { Vereda } from '../../territorios/entities/vereda.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoProyecto } from '../enums/estado-proyecto.enum';
import { TipoProyecto } from '../enums/tipo-proyecto.enum';
import { ProyectoAsociacion } from './proyecto-asociacion.entity';
import { ProyectoBeneficiario } from './proyecto-beneficiario.entity';

@Entity('proyectos')
@Unique('UQ_proyecto_nombre_tipo', ['nombre', 'tipo'])
export class Proyecto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'enum', enum: TipoProyecto })
  tipo: TipoProyecto;

  @Column({
    type: 'enum',
    enum: EstadoProyecto,
    default: EstadoProyecto.BORRADOR,
  })
  estado: EstadoProyecto;

  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: Date;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'creador_id' })
  creador: Usuario;

  @OneToMany(() => Actividad, (actividad) => actividad.proyecto)
  actividades: Actividad[];

  @OneToMany(() => ProyectoBeneficiario, (pb) => pb.proyecto, { cascade: true })
  proyectoBeneficiarios: ProyectoBeneficiario[];

  @OneToMany(() => ProyectoAsociacion, (pa) => pa.proyecto, { cascade: true })
  proyectoAsociaciones: ProyectoAsociacion[];

  @ManyToMany(() => Indicador, (indicador) => indicador.proyectos)
  indicadores: Indicador[];

  @ManyToMany(() => Vereda)
  @JoinTable({
    name: 'proyecto_veredas',
    joinColumn: { name: 'proyecto_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'vereda_id', referencedColumnName: 'id' },
  })
  veredas: Vereda[];

  @ManyToMany(() => Usuario)
  @JoinTable({
    name: 'proyecto_personal',
    joinColumn: { name: 'proyecto_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
  })
  personal: Usuario[];
}
