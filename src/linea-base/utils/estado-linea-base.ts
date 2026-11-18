import { EstadoLineaBase } from '../dto/linea-base.dto';

export const ETIQUETA_ESTADO_LINEA_BASE: Record<EstadoLineaBase, string> = {
  [EstadoLineaBase.SIN_ASIGNAR]: 'Sin asignar',
  [EstadoLineaBase.ASIGNADA]: 'Asignada',
  [EstadoLineaBase.ENVIADA]: 'Enviada',
  [EstadoLineaBase.EN_CORRECCION]: 'En corrección',
  [EstadoLineaBase.COMPLETA]: 'Completa',
};
