export const REDIS_DISPONIBLE = 'REDIS_DISPONIBLE';
export const NOMBRE_COLA_EVIDENCIAS = 'cola-evidencias';

export interface ProcesarEvidenciaJob {
  evidenciaId: string;
  rutaArchivo: string;
  urlRelativa: string;
  tipoMime?: string;
}

export interface GenerarMiniaturaJob {
  evidenciaId: string;
  rutaArchivo: string;
  urlRelativa: string;
}
