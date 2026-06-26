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
