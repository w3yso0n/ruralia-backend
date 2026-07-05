import { plainToInstance } from 'class-transformer';
import { Usuario } from '../entities/usuario.entity';
import {
  RespuestaPaginadaUsuariosDto,
  RespuestaUsuarioDto,
} from '../dto/respuesta-usuario.dto';

export function aRespuestaUsuario(usuario: Usuario): RespuestaUsuarioDto {
  return plainToInstance(RespuestaUsuarioDto, usuario, {
    excludeExtraneousValues: true,
  });
}

export function aRespuestaPaginadaUsuarios(
  datos: RespuestaUsuarioDto[],
  total: number,
  pagina: number,
  limite: number,
): RespuestaPaginadaUsuariosDto {
  return plainToInstance(
    RespuestaPaginadaUsuariosDto,
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
