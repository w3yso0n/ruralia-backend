import { Repository } from 'typeorm';
import { EstadoFuncional } from '../../common/workflow/estado-funcional.enum';
import { Jornada } from '../entities/jornada.entity';
import { EstadoJornada } from '../enums/estado-jornada.enum';

/**
 * Suma unidades ejecutadas hacia una meta.
 * Solo cuentan jornadas APROBADAS (vía revisión del supervisor o subida directa
 * sin revisión). Canceladas se excluyen en el WHERE.
 * - Con cantidad_ejecutada: suma ese valor.
 * - Sin cantidad pero COMPLETADA: cuenta 1 (jornadas legacy).
 */
/**
 * Primer y último día del mes como 'YYYY-MM-DD'. Se comparan como texto contra
 * la columna `date` para no depender de la zona horaria del servidor (con objetos
 * Date se perdían las jornadas del día 1 cuando el servidor y la BD difieren).
 */
export function rangoMes(
  anio: number,
  mes: number,
): { desde: string; hasta: string } {
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return {
    desde: `${anio}-${mm}-01`,
    hasta: `${anio}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

/** Rango de fechas de jornada: un mes concreto, o todo lo ejecutado hasta un día. */
export type OpcionesRangoJornada = {
  anio?: number;
  mes?: number;
  /** 'YYYY-MM-DD' inclusive; se usa cuando no hay anio/mes. */
  hasta?: string;
};

function aplicarRangoFechas(
  qb: ReturnType<Repository<Jornada>['createQueryBuilder']>,
  opciones?: OpcionesRangoJornada,
): void {
  if (opciones?.anio !== undefined && opciones?.mes !== undefined) {
    const { desde, hasta } = rangoMes(opciones.anio, opciones.mes);
    qb.andWhere('jornada.fecha >= :desdeRango', { desdeRango: desde }).andWhere(
      'jornada.fecha <= :hastaRango',
      { hastaRango: hasta },
    );
  } else if (opciones?.hasta) {
    qb.andWhere('jornada.fecha <= :hastaRango', { hastaRango: opciones.hasta });
  }
}

const SQL_SUMA_EJECUTADO = `
  COALESCE(SUM(
    CASE
      WHEN jornada.estado_funcional != :estadoAprobado THEN 0
      WHEN jornada.cantidad_ejecutada IS NOT NULL THEN jornada.cantidad_ejecutada
      WHEN jornada.estado = :estadoCompletada THEN 1
      ELSE 0
    END
  ), 0)
`;

export async function sumarEjecutadoPorMeta(
  jornadaRepository: Repository<Jornada>,
  metaId: string,
  opciones?: OpcionesRangoJornada,
): Promise<number> {
  const qb = jornadaRepository
    .createQueryBuilder('jornada')
    .select(SQL_SUMA_EJECUTADO, 'total')
    .where('jornada.meta_id = :metaId', { metaId })
    .andWhere('jornada.estado != :estadoCancelada', {
      estadoCancelada: EstadoJornada.CANCELADA,
    })
    .setParameter('estadoCompletada', EstadoJornada.COMPLETADA)
    .setParameter('estadoAprobado', EstadoFuncional.APROBADO);

  aplicarRangoFechas(qb, opciones);

  const resultado = await qb.getRawOne<{ total: string }>();
  return Number(resultado?.total ?? 0);
}

/** Ejecutado de un técnico hacia una meta (misma regla de aprobación). */
export async function sumarEjecutadoPorMetaYUsuario(
  jornadaRepository: Repository<Jornada>,
  metaId: string,
  usuarioId: string,
  opciones?: OpcionesRangoJornada,
): Promise<number> {
  const qb = jornadaRepository
    .createQueryBuilder('jornada')
    .select(SQL_SUMA_EJECUTADO, 'total')
    .where('jornada.meta_id = :metaId', { metaId })
    .andWhere('jornada.tecnico_responsable_id = :usuarioId', { usuarioId })
    .andWhere('jornada.estado != :estadoCancelada', {
      estadoCancelada: EstadoJornada.CANCELADA,
    })
    .setParameter('estadoCompletada', EstadoJornada.COMPLETADA)
    .setParameter('estadoAprobado', EstadoFuncional.APROBADO);

  aplicarRangoFechas(qb, opciones);

  const resultado = await qb.getRawOne<{ total: string }>();
  return Number(resultado?.total ?? 0);
}

export async function sumarEjecutadoPorProyecto(
  jornadaRepository: Repository<Jornada>,
  proyectoId: string,
): Promise<Map<string, number>> {
  const filas = await jornadaRepository
    .createQueryBuilder('jornada')
    .select('jornada.meta_id', 'metaId')
    .addSelect(SQL_SUMA_EJECUTADO, 'total')
    .where('jornada.proyecto_id = :proyectoId', { proyectoId })
    .andWhere('jornada.estado != :estadoCancelada', {
      estadoCancelada: EstadoJornada.CANCELADA,
    })
    .andWhere('jornada.meta_id IS NOT NULL')
    .setParameter('estadoCompletada', EstadoJornada.COMPLETADA)
    .setParameter('estadoAprobado', EstadoFuncional.APROBADO)
    .groupBy('jornada.meta_id')
    .getRawMany<{ metaId: string; total: string }>();

  const mapa = new Map<string, number>();
  for (const fila of filas) {
    mapa.set(fila.metaId, Number(fila.total));
  }
  return mapa;
}
