import { plainToInstance } from 'class-transformer';
import { Proyecto } from '../entities/proyecto.entity';
import {
  EstadisticasProyectoDto,
  RespuestaPaginadaProyectosDto,
  RespuestaProyectoDto,
} from '../dto/respuesta-proyecto.dto';

export function aRespuestaProyecto(
  proyecto: Proyecto & { conteoBeneficiarios?: number },
  extras?: Partial<RespuestaProyectoDto>,
): RespuestaProyectoDto {
  return plainToInstance(
    RespuestaProyectoDto,
    {
      ...proyecto,
      conteoBeneficiarios:
        extras?.conteoBeneficiarios ?? proyecto.conteoBeneficiarios,
      ...extras,
    },
    { excludeExtraneousValues: true },
  );
}

export function aRespuestaPaginada(
  datos: RespuestaProyectoDto[],
  total: number,
  pagina: number,
  limite: number,
): RespuestaPaginadaProyectosDto {
  return plainToInstance(
    RespuestaPaginadaProyectosDto,
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

export function aEstadisticasProyecto(
  estadisticas: EstadisticasProyectoDto,
): EstadisticasProyectoDto {
  return plainToInstance(EstadisticasProyectoDto, estadisticas, {
    excludeExtraneousValues: true,
  });
}

/**
 * Vista de consulta para el técnico: solo los datos generales del proyecto.
 * Sin equipo, beneficiarios, asociaciones, territorio, plan ni avance.
 */
export function aVistaLimitadaProyecto(
  dto: RespuestaProyectoDto,
): RespuestaProyectoDto {
  return plainToInstance(
    RespuestaProyectoDto,
    {
      id: dto.id,
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      tipo: dto.tipo,
      estado: dto.estado,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      creadoEn: dto.creadoEn,
      actualizadoEn: dto.actualizadoEn,
    },
    { excludeExtraneousValues: true },
  );
}
