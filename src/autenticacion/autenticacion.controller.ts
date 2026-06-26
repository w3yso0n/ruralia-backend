import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuarioActual } from './decorators/usuario-actual.decorator';

@ApiTags('Autenticación')
@ApiBearerAuth('bearer')
@Controller('autenticacion')
export class AutenticacionController {
  @Get('yo')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Datos del usuario actual' })
  obtenerYo(@UsuarioActual() usuario: Usuario): Usuario {
    return usuario;
  }
}
