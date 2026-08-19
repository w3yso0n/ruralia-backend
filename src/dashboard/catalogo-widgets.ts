import {
  TamanoWidgetDashboard,
  TipoWidgetDashboard,
} from './entities/widget-dashboard.entity';

export interface DefinicionWidget {
  clave: string;
  titulo: string;
  descripcion: string;
  tipo: TipoWidgetDashboard;
  /** null = disponible para cualquier usuario con dashboard.ver */
  permisoRequerido: string | null;
  tamanosPermitidos: TamanoWidgetDashboard[];
  tamanoPorDefecto: TamanoWidgetDashboard;
  orden: number;
}

const T = TamanoWidgetDashboard;

/**
 * Catálogo de widgets de la etapa 1: envuelve el dashboard actual (fijo) en
 * piezas independientes y reordenables. No agrega KPIs nuevos.
 */
export const CATALOGO_WIDGETS: DefinicionWidget[] = [
  {
    clave: 'kpi.proyectos_activos',
    titulo: 'Proyectos activos',
    descripcion: 'Proyectos en ejecución actualmente',
    tipo: TipoWidgetDashboard.KPI,
    permisoRequerido: 'dashboard.ver',
    tamanosPermitidos: [T.PEQUENO, T.MEDIANO, T.GRANDE, T.COMPLETO],
    tamanoPorDefecto: T.PEQUENO,
    orden: 10,
  },
  {
    clave: 'kpi.total_proyectos',
    titulo: 'Total de proyectos',
    descripcion: 'Todos los estados',
    tipo: TipoWidgetDashboard.KPI,
    permisoRequerido: 'dashboard.ver',
    tamanosPermitidos: [T.PEQUENO, T.MEDIANO, T.GRANDE, T.COMPLETO],
    tamanoPorDefecto: T.PEQUENO,
    orden: 20,
  },
  {
    clave: 'kpi.jornadas_registradas',
    titulo: 'Jornadas de campo',
    descripcion: 'Actividades registradas',
    tipo: TipoWidgetDashboard.KPI,
    permisoRequerido: 'dashboard.ver',
    tamanosPermitidos: [T.PEQUENO, T.MEDIANO, T.GRANDE, T.COMPLETO],
    tamanoPorDefecto: T.PEQUENO,
    orden: 30,
  },
  {
    clave: 'kpi.agentes_en_campo',
    titulo: 'Agentes en campo',
    descripcion: 'Técnicos con jornadas registradas',
    tipo: TipoWidgetDashboard.KPI,
    permisoRequerido: 'dashboard.ver',
    tamanosPermitidos: [T.PEQUENO, T.MEDIANO, T.GRANDE, T.COMPLETO],
    tamanoPorDefecto: T.PEQUENO,
    orden: 40,
  },
  {
    clave: 'medidor.cumplimiento_operativo',
    titulo: 'Cumplimiento operativo',
    descripcion:
      'Avance del plan, cobertura territorial, evidencia y jornadas del mes',
    tipo: TipoWidgetDashboard.MEDIDOR,
    permisoRequerido: 'dashboard.ver',
    tamanosPermitidos: [T.COMPLETO],
    tamanoPorDefecto: T.COMPLETO,
    orden: 50,
  },
  {
    clave: 'lista.agentes_eficientes',
    titulo: 'Agentes de campo más eficientes',
    descripcion: 'Top del mes por índice de eficiencia',
    tipo: TipoWidgetDashboard.LISTA,
    permisoRequerido: 'evaluaciones.ver',
    tamanosPermitidos: [T.COMPLETO],
    tamanoPorDefecto: T.COMPLETO,
    orden: 90,
  },
  {
    clave: 'grafica.actividad_mensual',
    titulo: 'Actividad mensual',
    descripcion: 'Jornadas, envíos de formulario y beneficiarios atendidos',
    tipo: TipoWidgetDashboard.GRAFICA,
    permisoRequerido: 'dashboard.ver',
    tamanosPermitidos: [T.MEDIANO, T.GRANDE, T.COMPLETO],
    tamanoPorDefecto: T.MEDIANO,
    orden: 100,
  },
  {
    clave: 'grafica.progreso_proyectos',
    titulo: 'Progreso por proyecto',
    descripcion: 'Avance del plan y beneficiarios vinculados',
    tipo: TipoWidgetDashboard.GRAFICA,
    permisoRequerido: 'proyectos.ver',
    tamanosPermitidos: [T.MEDIANO, T.GRANDE, T.COMPLETO],
    tamanoPorDefecto: T.MEDIANO,
    orden: 110,
  },
  {
    clave: 'mapa.cobertura_veredas',
    titulo: 'Mapa de cobertura territorial',
    descripcion: 'Veredas con proyectos activos e inactivos',
    tipo: TipoWidgetDashboard.MAPA,
    permisoRequerido: 'territorios.ver',
    tamanosPermitidos: [T.COMPLETO],
    tamanoPorDefecto: T.COMPLETO,
    orden: 120,
  },
  {
    clave: 'tabla.proyectos_recientes',
    titulo: 'Proyectos activos recientes',
    descripcion: 'Últimos proyectos en ejecución',
    tipo: TipoWidgetDashboard.TABLA,
    permisoRequerido: 'proyectos.ver',
    tamanosPermitidos: [T.MEDIANO, T.GRANDE, T.COMPLETO],
    tamanoPorDefecto: T.MEDIANO,
    orden: 130,
  },
  {
    clave: 'tabla.jornadas_recientes',
    titulo: 'Jornadas recientes',
    descripcion: 'Actividad de campo registrada por técnicos',
    tipo: TipoWidgetDashboard.TABLA,
    permisoRequerido: 'jornadas.ver',
    tamanosPermitidos: [T.MEDIANO, T.GRANDE, T.COMPLETO],
    tamanoPorDefecto: T.MEDIANO,
    orden: 140,
  },
];

/** Layout de fábrica: el orden y tamaño actuales del dashboard fijo, usado como fallback. */
export const LAYOUT_POR_DEFECTO: {
  clave: string;
  tamano: TamanoWidgetDashboard;
}[] = CATALOGO_WIDGETS.slice()
  .sort((a, b) => a.orden - b.orden)
  .map((w) => ({ clave: w.clave, tamano: w.tamanoPorDefecto }));
