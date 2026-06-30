import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RespuestaUsuarioDto } from '../usuarios/dto/respuesta-usuario.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuarioActual } from './decorators/usuario-actual.decorator';

@ApiTags('Autenticación')
@ApiBearerAuth('bearer')
@Controller('autenticacion')
export class AutenticacionController {
  @Get('yo')
  @ApiOperation({
    summary: 'Obtener perfil del usuario autenticado',
    description:
      'Devuelve los datos del usuario actual junto con sus roles asignados. Requiere token JWT de Firebase válido.',
  })
  @ApiResponse({ status: 200, type: RespuestaUsuarioDto })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  obtenerYo(@UsuarioActual() usuario: Usuario): Usuario {
    return usuario;
  }
}
