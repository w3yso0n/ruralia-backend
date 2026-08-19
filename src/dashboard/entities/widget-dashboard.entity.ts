import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Tipo de widget: determina qué componente lo renderiza en el frontend. */
export enum TipoWidgetDashboard {
  KPI = 'KPI',
  MEDIDOR = 'MEDIDOR',
  METRICA = 'METRICA',
  GRAFICA = 'GRAFICA',
  MAPA = 'MAPA',
  TABLA = 'TABLA',
  LISTA = 'LISTA',
}

/** Tamaño del widget dentro del bento grid (columnas x filas, base 1 = 1 celda). */
export enum TamanoWidgetDashboard {
  PEQUENO = 'PEQUENO', // 1x1
  MEDIANO = 'MEDIANO', // 2x1
  GRANDE = 'GRANDE', // 2x2
  COMPLETO = 'COMPLETO', // 4x1 / ancho completo
}

/**
 * Catálogo de widgets disponibles para el dashboard personalizable.
 * Sembrado por código (WidgetsDashboardSeedService), no editable desde la UI.
 */
@Entity('widgets_dashboard')
export class WidgetDashboard {
  /** Clave estable usada por el frontend para mapear al componente (ej. 'kpi.proyectos_activos'). */
  @PrimaryColumn()
  clave: string;

  @Column()
  titulo: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ type: 'enum', enum: TipoWidgetDashboard })
  tipo: TipoWidgetDashboard;

  @Column({
    name: 'permiso_requerido',
    type: 'varchar',
    nullable: true,
    comment:
      'Clave del catálogo de permisos que habilita ver/agregar este widget',
  })
  permisoRequerido: string | null;

  @Column({
    name: 'tamanos_permitidos',
    type: 'simple-array',
  })
  tamanosPermitidos: TamanoWidgetDashboard[];

  @Column({
    name: 'tamano_por_defecto',
    type: 'enum',
    enum: TamanoWidgetDashboard,
  })
  tamanoPorDefecto: TamanoWidgetDashboard;

  @Column({ default: 0 })
  orden: number;

  @Column({ name: 'esta_activo', default: true })
  estaActivo: boolean;
}
