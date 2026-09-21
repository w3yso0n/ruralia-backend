import { plainToInstance } from 'class-transformer';
import { RespuestaGeocercaDto } from '../dto/geocerca.dto';
import { Geocerca } from '../entities/geocerca.entity';

export function aRespuestaGeocerca(geocerca: Geocerca): RespuestaGeocercaDto {
  return plainToInstance(
    RespuestaGeocercaDto,
    {
      id: geocerca.id,
      proyectoId: geocerca.proyectoId,
      nombre: geocerca.nombre,
      descripcion: geocerca.descripcion,
      color: geocerca.color,
      puntos: geocerca.puntos ?? [],
      creadoEn: geocerca.creadoEn,
      actualizadoEn: geocerca.actualizadoEn,
    },
    { excludeExtraneousValues: true },
  );
}
