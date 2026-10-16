import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Cadena configurada en el proyecto. No modifica jornadas que ya tienen pasos. */
@Entity('niveles_aprobacion_proyecto')
@Unique('UQ_nivel_aprobacion_proyecto_orden', ['proyectoId', 'orden'])
export class NivelAprobacionProyecto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'proyecto_id', type: 'uuid' })
  proyectoId: string;

  @Column({ type: 'int' })
  orden: number;

  @Column({ name: 'rol_id', type: 'uuid', nullable: true })
  rolId: string | null;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;
}
