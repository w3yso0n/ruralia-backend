import { plainToInstance } from 'class-transformer';
import { Jornada } from '../entities/jornada.entity';
import {
  ResumenJornadaDto,
  RespuestaJornadaDto,
  RespuestaPaginadaJornadasDto,
} from '../dto/respuesta-jornada.dto';

export function aRespuestaJornada(
  jornada: Jornada,
  extras?: Partial<RespuestaJornadaDto>,
): RespuestaJornadaDto {
  return plainToInstance(
    RespuestaJornadaDto,
    { ...jornada, ...extras },
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
