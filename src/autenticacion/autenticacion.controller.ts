import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RespuestaUsuarioDto } from '../usuarios/dto/respuesta-usuario.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { aRespuestaUsuario } from '../usuarios/utils/serializar-usuario';
import { SoloAutenticado } from './decorators/solo-autenticado.decorator';
import { UsuarioActual } from './decorators/usuario-actual.decorator';

@ApiTags('Autenticación')
@ApiBearerAuth('bearer')
@Controller('autenticacion')
export class AutenticacionController {
  @Get('yo')
  @SoloAutenticado()
  @ApiOperation({
    summary: 'Obtener perfil del usuario autenticado',
    description:
      'Devuelve los datos del usuario actual, roles y permisos efectivos.',
  })
  @ApiResponse({ status: 200, type: RespuestaUsuarioDto })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  obtenerYo(@UsuarioActual() usuario: Usuario): RespuestaUsuarioDto {
    return aRespuestaUsuario(usuario);
  }
}
