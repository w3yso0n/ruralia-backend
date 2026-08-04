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
  opciones?: { anio?: number; mes?: number },
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

  if (opciones?.anio !== undefined && opciones?.mes !== undefined) {
    const inicio = new Date(opciones.anio, opciones.mes - 1, 1);
    const fin = new Date(opciones.anio, opciones.mes, 0);
    qb.andWhere('jornada.fecha >= :inicio', { inicio }).andWhere(
      'jornada.fecha <= :fin',
      { fin },
    );
  }

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
