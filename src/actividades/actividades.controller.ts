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
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadesService } from './actividades.service';
import {
  ActualizarActividadDto,
  ActualizarSubactividadDto,
  CompletarNodoPlanDto,
  CrearActividadDto,
  CrearSubactividadDto,
} from './dto/actividad.dto';
import {
  RespuestaActividadDto,
  RespuestaPlanProyectoDto,
  RespuestaProgresoProyectoDto,
  RespuestaSubactividadDto,
} from './dto/respuesta-actividad.dto';

@ApiTags('Actividades')
@ApiBearerAuth('bearer')
@Controller()
export class ActividadesController {
  constructor(private readonly actividadesService: ActividadesService) {}

  @Get('proyectos/:proyectoId/plan')
  @ApiOperation({ summary: 'Obtener el plan de trabajo del proyecto' })
  @ApiResponse({ status: 200, type: RespuestaPlanProyectoDto })
  obtenerPlan(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
  ): Promise<RespuestaPlanProyectoDto> {
    return this.actividadesService.obtenerPlan(proyectoId);
  }

  @Get('proyectos/:proyectoId/progreso')
  @ApiOperation({ summary: 'Obtener el progreso agregado del plan' })
  @ApiResponse({ status: 200, type: RespuestaProgresoProyectoDto })
  obtenerProgreso(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
  ): Promise<RespuestaProgresoProyectoDto> {
    return this.actividadesService.obtenerProgreso(proyectoId);
  }

  @Post('proyectos/:proyectoId/actividades')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Crear una actividad en el plan del proyecto' })
  @ApiResponse({ status: 201, type: RespuestaActividadDto })
  crearActividad(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: CrearActividadDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaActividadDto> {
    return this.actividadesService.crearActividad(proyectoId, dto, usuario);
  }

  @Patch('actividades/:id')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Actualizar una actividad del plan' })
  @ApiResponse({ status: 200, type: RespuestaActividadDto })
  actualizarActividad(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarActividadDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaActividadDto> {
    return this.actividadesService.actualizarActividad(id, dto, usuario);
  }

  @Delete('actividades/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Desactivar una actividad del plan' })
  eliminarActividad(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<void> {
    return this.actividadesService.eliminarActividad(id, usuario);
  }

  @Patch('actividades/:id/completar')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Marcar una actividad hoja como completada' })
  @ApiResponse({ status: 200, type: RespuestaActividadDto })
  completarActividad(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompletarNodoPlanDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaActividadDto> {
    return this.actividadesService.completarActividad(id, dto, usuario);
  }

  @Patch('actividades/:id/reabrir')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Reabrir una actividad completada' })
  @ApiResponse({ status: 200, type: RespuestaActividadDto })
  reabrirActividad(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaActividadDto> {
    return this.actividadesService.reabrirActividad(id, usuario);
  }

  @Post('actividades/:actividadId/subactividades')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Crear una subactividad' })
  @ApiResponse({ status: 201, type: RespuestaSubactividadDto })
  crearSubactividad(
    @Param('actividadId', ParseUUIDPipe) actividadId: string,
    @Body() dto: CrearSubactividadDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaSubactividadDto> {
    return this.actividadesService.crearSubactividad(actividadId, dto, usuario);
  }

  @Patch('subactividades/:id')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Actualizar una subactividad' })
  @ApiResponse({ status: 200, type: RespuestaSubactividadDto })
  actualizarSubactividad(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarSubactividadDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaSubactividadDto> {
    return this.actividadesService.actualizarSubactividad(id, dto, usuario);
  }

  @Delete('subactividades/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Desactivar una subactividad' })
  eliminarSubactividad(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<void> {
    return this.actividadesService.eliminarSubactividad(id, usuario);
  }

  @Patch('subactividades/:id/completar')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Marcar una subactividad como completada' })
  @ApiResponse({ status: 200, type: RespuestaSubactividadDto })
  completarSubactividad(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompletarNodoPlanDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaSubactividadDto> {
    return this.actividadesService.completarSubactividad(id, dto, usuario);
  }

  @Patch('subactividades/:id/reabrir')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Reabrir una subactividad completada' })
  @ApiResponse({ status: 200, type: RespuestaSubactividadDto })
  reabrirSubactividad(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaSubactividadDto> {
    return this.actividadesService.reabrirSubactividad(id, usuario);
  }
}
