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
  Put,
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
import { AlcanceTerritorialService } from './alcance-territorial.service';
import { ReemplazarAlcanceTerritorialDto } from './dto/alcance-territorial.dto';
import {
  ProyectoAsignadoUsuarioDto,
  ReemplazarProyectosUsuarioDto,
} from './dto/proyectos-usuario.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@ApiBearerAuth('bearer')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

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

  @Get(':id/alcance')
  @RequierePermisos('usuarios.ver')
  @ApiOperation({ summary: 'Territorio asignado a un coordinador' })
  listarAlcance(@Param('id', ParseUUIDPipe) id: string) {
    return this.alcanceTerritorialService.listar(id);
  }

  @Put(':id/alcance')
  @RequierePermisos('usuarios.editar')
  @ApiOperation({
    summary: 'Reemplaza el territorio asignado a un coordinador',
  })
  reemplazarAlcance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReemplazarAlcanceTerritorialDto,
  ) {
    return this.alcanceTerritorialService.reemplazar(id, dto.items);
  }

  @Get(':id/proyectos')
  @RequierePermisos('usuarios.ver')
  @ApiOperation({ summary: 'Proyectos donde el usuario está asignado' })
  @ApiResponse({ status: 200, type: [ProyectoAsignadoUsuarioDto] })
  listarProyectos(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.listarProyectosAsignados(id);
  }

  @Put(':id/proyectos')
  @RequierePermisos('usuarios.editar')
  @ApiOperation({
    summary: 'Reemplaza los proyectos donde el usuario está asignado',
  })
  @ApiResponse({ status: 200, type: [ProyectoAsignadoUsuarioDto] })
  reemplazarProyectos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReemplazarProyectosUsuarioDto,
  ) {
    return this.usuariosService.reemplazarProyectosAsignados(
      id,
      dto.proyectoIds,
    );
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

  @Post(':id/desactivar')
  @RequierePermisos('usuarios.eliminar')
  @ApiOperation({
    summary: 'Desactivar un usuario (reversible)',
    description:
      'Impide el inicio de sesión. Se puede volver a activar desde el listado.',
  })
  @ApiResponse({ status: 201, type: RespuestaUsuarioDto })
  desactivar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaUsuarioDto> {
    return this.usuariosService.desactivar(id, usuario);
  }

  @Post(':id/reactivar')
  @RequierePermisos('usuarios.eliminar')
  @ApiOperation({ summary: 'Volver a activar un usuario desactivado' })
  @ApiResponse({ status: 201, type: RespuestaUsuarioDto })
  reactivar(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaUsuarioDto> {
    return this.usuariosService.reactivar(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('usuarios.eliminar')
  @ApiOperation({
    summary: 'Eliminar un usuario de forma definitiva',
    description:
      'Deja de aparecer en el listado y pierde el acceso. No se puede reactivar. El historial de proyectos y jornadas conserva su nombre.',
  })
  @ApiResponse({ status: 204, description: 'Usuario eliminado' })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<void> {
    return this.usuariosService.eliminar(id, usuario);
  }
}
