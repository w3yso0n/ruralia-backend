import { plainToInstance } from 'class-transformer';
import { Jornada } from '../entities/jornada.entity';
import {
  ResumenJornadaDto,
  RespuestaHermanoGrupoDto,
  RespuestaJornadaActividadDto,
  RespuestaJornadaDto,
  RespuestaMetaResumenDto,
  RespuestaPaginadaJornadasDto,
  RespuestaResumenDto,
} from '../dto/respuesta-jornada.dto';

function mapearActividades(jornada: Jornada): RespuestaJornadaActividadDto[] {
  return (jornada.jornadaActividades ?? []).map((ja) =>
    plainToInstance(
      RespuestaJornadaActividadDto,
      {
        id: ja.id,
        actividad: ja.actividad
          ? { id: ja.actividad.id, nombre: ja.actividad.nombre }
          : undefined,
        subactividad: ja.subactividad
          ? { id: ja.subactividad.id, nombre: ja.subactividad.nombre }
          : undefined,
        estadoEjecucion: ja.estadoEjecucion,
        nota: ja.nota,
        orden: ja.orden,
      },
      { excludeExtraneousValues: true },
    ),
  );
}

export function aRespuestaJornada(
  jornada: Jornada,
  extras?: Partial<RespuestaJornadaDto> & { metaEjecutadoTotal?: number },
): RespuestaJornadaDto {
  const actividades = mapearActividades(jornada);

  return plainToInstance(
    RespuestaJornadaDto,
    {
      ...jornada,
      actividades,
      proyecto: jornada.proyecto
        ? ({
            id: jornada.proyecto.id,
            nombre: jornada.proyecto.nombre,
          } as RespuestaResumenDto)
        : undefined,
      meta: jornada.meta
        ? plainToInstance(
            RespuestaMetaResumenDto,
            {
              id: jornada.meta.id,
              nombre: jornada.meta.nombre,
              unidadMedida: jornada.meta.unidadMedida,
              cantidadTotal:
                jornada.meta.cantidadTotal != null
                  ? Number(jornada.meta.cantidadTotal)
                  : undefined,
              ejecutadoTotal: extras?.metaEjecutadoTotal,
              procesoNombre: jornada.meta.proceso?.nombre,
              subactividadNombre: jornada.meta.proceso?.subactividad?.nombre,
              actividadNombre:
                jornada.meta.proceso?.subactividad?.actividad?.nombre,
            },
            { excludeExtraneousValues: true },
          )
        : undefined,
      vereda: jornada.vereda
        ? ({
            id: jornada.vereda.id,
            nombre: jornada.vereda.nombre,
          } as RespuestaResumenDto)
        : undefined,
      tecnicoResponsable: {
        id: jornada.tecnicoResponsable?.id ?? '',
        nombre:
          jornada.tecnicoResponsableNombre ||
          jornada.tecnicoResponsable?.nombreCompleto ||
          '',
      } as RespuestaResumenDto,
      beneficiarios: jornada.beneficiarios?.map((b) => ({
        id: b.id,
        nombre: `${b.nombres} ${b.apellidos}`,
      })),
      equipo: jornada.equipo?.map((u) => ({
        id: u.id,
        nombre: u.nombreCompleto,
      })),
      asistentes: (jornada.asistentes ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((a) => ({
          id: a.id,
          nombreCompleto: a.nombreCompleto,
          documento: a.documento,
          firmaDataUrl: a.firmaDataUrl,
          firmadoEn: a.firmadoEn,
          orden: a.orden,
        })),
      grupoJornadaId: jornada.grupoJornadaId ?? null,
      ...extras,
    },
    { excludeExtraneousValues: true },
  );
}

export function aHermanoGrupo(jornada: Jornada): RespuestaHermanoGrupoDto {
  return plainToInstance(
    RespuestaHermanoGrupoDto,
    {
      id: jornada.id,
      estado: jornada.estado,
      tecnicoResponsable: {
        id: jornada.tecnicoResponsable?.id ?? '',
        nombre:
          jornada.tecnicoResponsableNombre ||
          jornada.tecnicoResponsable?.nombreCompleto ||
          '',
      } as RespuestaResumenDto,
    },
    { excludeExtraneousValues: true },
  );
}

export function aRespuestaPaginadaJornadas(
  datos: RespuestaJornadaDto[],
  total: number,
  pagina: number,
  limite: number,
): RespuestaPaginadaJornadasDto {
  return plainToInstance(
    RespuestaPaginadaJornadasDto,
    {
      datos,
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite) || 0,
    },
    { excludeExtraneousValues: true },
  );
}

export function aResumenJornada(resumen: ResumenJornadaDto): ResumenJornadaDto {
  return plainToInstance(ResumenJornadaDto, resumen, {
    excludeExtraneousValues: true,
  });
}
