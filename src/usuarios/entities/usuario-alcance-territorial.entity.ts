import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TipoAlcanceTerritorial } from '../enums/tipo-alcance-territorial.enum';
import { Usuario } from './usuario.entity';

@Entity('usuario_alcance_territorial')
@Unique('UQ_usuario_alcance_nodo', ['usuarioId', 'tipo', 'referenciaId'])
export class UsuarioAlcanceTerritorial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_usuario_alcance_usuario')
  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'enum', enum: TipoAlcanceTerritorial })
  tipo: TipoAlcanceTerritorial;

  @Column({ name: 'referencia_id', type: 'uuid' })
  referenciaId: string;
}
