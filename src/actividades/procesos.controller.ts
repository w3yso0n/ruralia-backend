import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarMetaDto,
  ActualizarMetaPeriodoDto,
  ActualizarProcesoDto,
  CrearMetaDto,
  CrearMetaPeriodoDto,
  CrearProcesoDto,
} from './dto/proceso.dto';
import {
  RespuestaAvancePeriodoDto,
  RespuestaMetaDto,
  RespuestaMetaPeriodoDto,
  RespuestaProcesoDto,
} from './dto/respuesta-proceso.dto';
import { ProcesosService } from './procesos.service';

@ApiTags('Procesos y Metas')
@ApiBearerAuth('bearer')
@Controller()
export class ProcesosController {
  constructor(private readonly procesosService: ProcesosService) {}

  @Get('subactividades/:subactividadId/procesos')
  @RequierePermisos('actividades.ver')
  @ApiOperation({ summary: 'Listar procesos de una subactividad' })
  @ApiResponse({ status: 200, type: [RespuestaProcesoDto] })
  listarProcesos(
    @Param('subactividadId', ParseUUIDPipe) subactividadId: string,
  ): Promise<RespuestaProcesoDto[]> {
    return this.procesosService.listarProcesos(subactividadId);
  }

  @Post('subactividades/:subactividadId/procesos')
  @RequierePermisos('actividades.crear')
  @ApiOperation({ summary: 'Crear un proceso en una subactividad' })
  @ApiResponse({ status: 201, type: RespuestaProcesoDto })
  crearProceso(
    @Param('subactividadId', ParseUUIDPipe) subactividadId: string,
    @Body() dto: CrearProcesoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProcesoDto> {
    return this.procesosService.crearProceso(subactividadId, dto, usuario);
  }

  @Patch('procesos/:id')
  @RequierePermisos('actividades.editar')
  @ApiOperation({ summary: 'Actualizar un proceso' })
  @ApiResponse({ status: 200, type: RespuestaProcesoDto })
  actualizarProceso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProcesoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProcesoDto> {
    return this.procesosService.actualizarProceso(id, dto, usuario);
  }

  @Delete('procesos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('actividades.eliminar')
  @ApiOperation({ summary: 'Desactivar un proceso' })
  eliminarProceso(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<void> {
    return this.procesosService.eliminarProceso(id, usuario);
  }

  @Post('procesos/:procesoId/metas')
  @RequierePermisos('actividades.crear')
  @ApiOperation({ summary: 'Crear una meta en un proceso' })
  @ApiResponse({ status: 201, type: RespuestaMetaDto })
  crearMeta(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body() dto: CrearMetaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaMetaDto> {
    return this.procesosService.crearMeta(procesoId, dto, usuario);
  }

  @Patch('metas/:id')
  @RequierePermisos('actividades.editar')
  @ApiOperation({ summary: 'Actualizar una meta' })
  @ApiResponse({ status: 200, type: RespuestaMetaDto })
  actualizarMeta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMetaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaMetaDto> {
    return this.procesosService.actualizarMeta(id, dto, usuario);
  }

  @Delete('metas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('actividades.eliminar')
  @ApiOperation({ summary: 'Desactivar una meta' })
  eliminarMeta(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<void> {
    return this.procesosService.eliminarMeta(id, usuario);
  }

  @Post('metas/:metaId/periodos')
  @RequierePermisos('actividades.crear')
  @ApiOperation({ summary: 'Crear un período planeado para una meta' })
  @ApiResponse({ status: 201, type: RespuestaMetaPeriodoDto })
  crearMetaPeriodo(
    @Param('metaId', ParseUUIDPipe) metaId: string,
    @Body() dto: CrearMetaPeriodoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaMetaPeriodoDto> {
    return this.procesosService.crearMetaPeriodo(metaId, dto, usuario);
  }

  @Patch('meta-periodos/:id')
  @RequierePermisos('actividades.editar')
  @ApiOperation({ summary: 'Actualizar un período de meta' })
  @ApiResponse({ status: 200, type: RespuestaMetaPeriodoDto })
  actualizarMetaPeriodo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMetaPeriodoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaMetaPeriodoDto> {
    return this.procesosService.actualizarMetaPeriodo(id, dto, usuario);
  }

  @Delete('meta-periodos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('actividades.eliminar')
  @ApiOperation({ summary: 'Eliminar un período de meta' })
  eliminarMetaPeriodo(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<void> {
    return this.procesosService.eliminarMetaPeriodo(id, usuario);
  }

  @Get('proyectos/:proyectoId/avance-periodo')
  @RequierePermisos('actividades.ver')
  @ApiOperation({
    summary:
      'Avance físico mensual y acumulado de todas las metas de un proyecto',
  })
  @ApiQuery({ name: 'anio', type: Number })
  @ApiQuery({ name: 'mes', type: Number })
  @ApiResponse({ status: 200, type: [RespuestaAvancePeriodoDto] })
  obtenerAvancePorPeriodo(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query('anio', ParseIntPipe) anio: number,
    @Query('mes', ParseIntPipe) mes: number,
  ): Promise<RespuestaAvancePeriodoDto[]> {
    return this.procesosService.obtenerAvancePorPeriodo(proyectoId, anio, mes);
  }
}
