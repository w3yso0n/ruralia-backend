import { plainToInstance } from 'class-transformer';
import { Asociacion } from '../entities/asociacion.entity';
import {
  RespuestaAsociacionDto,
  RespuestaPaginadaAsociacionesDto,
} from '../dto/respuesta-asociacion.dto';

export function aRespuestaAsociacion(
  asociacion: Asociacion,
): RespuestaAsociacionDto {
  return plainToInstance(RespuestaAsociacionDto, asociacion, {
    excludeExtraneousValues: true,
  });
}

export function aRespuestaPaginadaAsociaciones(
  datos: RespuestaAsociacionDto[],
  total: number,
  pagina: number,
  limite: number,
): RespuestaPaginadaAsociacionesDto {
  return plainToInstance(
    RespuestaPaginadaAsociacionesDto,
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
