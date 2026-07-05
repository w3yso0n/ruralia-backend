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
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { RolEnum } from '../autenticacion/enums/rol.enum';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { FiltrosUsuarioDto } from './dto/filtros-usuario.dto';
import {
  RespuestaPaginadaUsuariosDto,
  RespuestaRolDto,
  RespuestaUsuarioDto,
} from './dto/respuesta-usuario.dto';
import { Usuario } from './entities/usuario.entity';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@ApiBearerAuth('bearer')
@Controller('usuarios')
@Roles(RolEnum.ADMINISTRADOR)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Listar roles disponibles' })
  @ApiResponse({ status: 200, type: [RespuestaRolDto] })
  listarRoles(): Promise<RespuestaRolDto[]> {
    return this.usuariosService.listarRoles();
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios con filtros y paginación' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaUsuariosDto })
  listar(
    @Query() filtros: FiltrosUsuarioDto,
  ): Promise<RespuestaPaginadaUsuariosDto> {
    return this.usuariosService.listar(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiResponse({ status: 200, type: RespuestaUsuarioDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaUsuarioDto> {
    return this.usuariosService.obtenerUno(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un usuario (Firebase + base de datos)' })
  @ApiResponse({ status: 201, type: RespuestaUsuarioDto })
  crear(@Body() dto: CrearUsuarioDto): Promise<RespuestaUsuarioDto> {
    return this.usuariosService.crear(dto);
  }

  @Patch(':id')
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
  @ApiOperation({ summary: 'Desactivar un usuario' })
  @ApiResponse({ status: 204, description: 'Usuario desactivado' })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<void> {
    return this.usuariosService.eliminar(id, usuario);
  }
}
