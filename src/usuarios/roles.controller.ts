import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { SoloAutenticado } from '../autenticacion/decorators/solo-autenticado.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { ActualizarRolDto } from './dto/actualizar-rol.dto';
import { CrearRolDto } from './dto/crear-rol.dto';
import {
  RespuestaModuloPermisosDto,
  RespuestaRolDetalleDto,
} from './dto/respuesta-rol.dto';
import { Usuario } from './entities/usuario.entity';
import { RolesService } from './roles.service';
import { usuarioTieneAlgunPermiso } from './utils/permisos-usuario';

@ApiTags('Roles')
@ApiBearerAuth('bearer')
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permisos')
  @RequierePermisos('roles.ver')
  @ApiOperation({ summary: 'Catálogo de permisos agrupado por módulo' })
  @ApiResponse({ status: 200, type: [RespuestaModuloPermisosDto] })
  listarPermisos(): Promise<RespuestaModuloPermisosDto[]> {
    return this.rolesService.listarPermisosAgrupados();
  }

  @Get('roles')
  @SoloAutenticado()
  @ApiOperation({ summary: 'Listar roles con conteo de permisos' })
  @ApiResponse({ status: 200, type: [RespuestaRolDetalleDto] })
  listarRoles(
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaRolDetalleDto[]> {
    if (
      !usuarioTieneAlgunPermiso(usuario, [
        'roles.ver',
        'usuarios.crear',
        'usuarios.editar',
        'usuarios.gestionar_roles',
      ])
    ) {
      throw new ForbiddenException(
        'No tiene permisos para acceder a este recurso',
      );
    }
    return this.rolesService.listar();
  }

  @Get('roles/:id')
  @RequierePermisos('roles.ver')
  @ApiOperation({ summary: 'Obtener un rol con su matriz de permisos' })
  @ApiResponse({ status: 200, type: RespuestaRolDetalleDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaRolDetalleDto> {
    return this.rolesService.obtenerUno(id);
  }

  @Post('roles')
  @RequierePermisos('roles.crear')
  @ApiOperation({ summary: 'Crear un rol personalizado' })
  @ApiResponse({ status: 201, type: RespuestaRolDetalleDto })
  crear(@Body() dto: CrearRolDto): Promise<RespuestaRolDetalleDto> {
    return this.rolesService.crear(dto);
  }

  @Post('roles/:id/clonar')
  @RequierePermisos('roles.crear')
  @ApiOperation({
    summary:
      'Clonar un rol (copia la matriz; el clon siempre es personalizado)',
  })
  @ApiResponse({ status: 201, type: RespuestaRolDetalleDto })
  clonar(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaRolDetalleDto> {
    return this.rolesService.clonar(id);
  }

  @Patch('roles/:id')
  @RequierePermisos('roles.editar')
  @ApiOperation({ summary: 'Actualizar un rol y su matriz de permisos' })
  @ApiResponse({ status: 200, type: RespuestaRolDetalleDto })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarRolDto,
  ): Promise<RespuestaRolDetalleDto> {
    return this.rolesService.actualizar(id, dto);
  }

  @Post('roles/:id/restablecer')
  @RequierePermisos('roles.editar')
  @ApiOperation({
    summary: 'Restablecer un rol de sistema a su matriz de permisos de fábrica',
  })
  @ApiResponse({ status: 200, type: RespuestaRolDetalleDto })
  restablecer(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaRolDetalleDto> {
    return this.rolesService.restablecerAValoresDeFabrica(id);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('roles.eliminar')
  @ApiOperation({ summary: 'Eliminar un rol personalizado' })
  @ApiResponse({ status: 204, description: 'Rol eliminado' })
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.rolesService.eliminar(id);
  }
}
