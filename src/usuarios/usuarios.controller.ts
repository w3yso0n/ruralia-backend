import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { FiltrosUsuarioDto } from './dto/filtros-usuario.dto';
import {
  RespuestaPaginadaUsuariosDto,
  RespuestaUsuarioDto,
} from './dto/respuesta-usuario.dto';
import { Usuario } from './entities/usuario.entity';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@ApiBearerAuth('bearer')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @RequierePermisos('usuarios.ver')
  @ApiOperation({ summary: 'Listar usuarios con filtros y paginación' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaUsuariosDto })
  listar(
    @Query() filtros: FiltrosUsuarioDto,
  ): Promise<RespuestaPaginadaUsuariosDto> {
    return this.usuariosService.listar(filtros);
  }

  @Get(':id')
  @RequierePermisos('usuarios.ver')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiResponse({ status: 200, type: RespuestaUsuarioDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaUsuarioDto> {
    return this.usuariosService.obtenerUno(id);
  }

  @Post()
  @RequierePermisos('usuarios.crear')
  @ApiOperation({ summary: 'Crear un usuario (Firebase + base de datos)' })
  @ApiResponse({ status: 201, type: RespuestaUsuarioDto })
  crear(@Body() dto: CrearUsuarioDto): Promise<RespuestaUsuarioDto> {
    return this.usuariosService.crear(dto);
  }

  @Patch(':id')
  @RequierePermisos('usuarios.editar')
  @ApiOperation({ summary: 'Actualizar datos y roles de un usuario' })
  @ApiResponse({ status: 200, type: RespuestaUsuarioDto })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaUsuarioDto> {
    return this.usuariosService.actualizar(id, dto, usuario);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('usuarios.eliminar')
  @ApiOperation({ summary: 'Desactivar un usuario' })
  @ApiResponse({ status: 204, description: 'Usuario desactivado' })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<void> {
    return this.usuariosService.eliminar(id, usuario);
  }
}
