import { plainToInstance } from 'class-transformer';
import { Indicador } from '../entities/indicador.entity';
import { RegistroIndicador } from '../entities/registro-indicador.entity';
import {
  AvanceIndicadorDto,
  PuntoLineaTiempoDto,
  RespuestaIndicadorDto,
  RespuestaRegistroIndicadorDto,
} from '../dto/respuesta-indicador.dto';

export function aRespuestaIndicador(
  indicador: Indicador,
): RespuestaIndicadorDto {
  return plainToInstance(RespuestaIndicadorDto, indicador, {
    excludeExtraneousValues: true,
  });
}

export function aRespuestaRegistro(
  registro: RegistroIndicador,
): RespuestaRegistroIndicadorDto {
  return plainToInstance(RespuestaRegistroIndicadorDto, registro, {
    excludeExtraneousValues: true,
  });
}

export function aAvanceIndicador(
  datos: AvanceIndicadorDto,
): AvanceIndicadorDto {
  return plainToInstance(AvanceIndicadorDto, datos, {
    excludeExtraneousValues: true,
  });
}

export function aLineaTiempo(
  puntos: PuntoLineaTiempoDto[],
): PuntoLineaTiempoDto[] {
  return plainToInstance(PuntoLineaTiempoDto, puntos, {
    excludeExtraneousValues: true,
  });
}
