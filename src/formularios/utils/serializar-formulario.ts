import { plainToInstance } from 'class-transformer';
import { PlantillaFormulario } from '../entities/plantilla-formulario.entity';
import { EnvioFormulario } from '../entities/envio-formulario.entity';
import {
  RespuestaDetalleRespuestaDto,
  RespuestaEnvioFormularioDto,
  RespuestaPlantillaFormularioDto,
} from '../dto/respuesta-formulario.dto';

export function aRespuestaPlantilla(
  plantilla: PlantillaFormulario,
): RespuestaPlantillaFormularioDto {
  return plainToInstance(RespuestaPlantillaFormularioDto, plantilla, {
    excludeExtraneousValues: true,
  });
}

export function aRespuestaEnvio(
  envio: EnvioFormulario,
): RespuestaEnvioFormularioDto {
  return plainToInstance(RespuestaEnvioFormularioDto, envio, {
    excludeExtraneousValues: true,
  });
}

export function aRespuestaDetalle(
  datos: RespuestaDetalleRespuestaDto[],
): RespuestaDetalleRespuestaDto[] {
  return plainToInstance(RespuestaDetalleRespuestaDto, datos, {
    excludeExtraneousValues: true,
  });
}
