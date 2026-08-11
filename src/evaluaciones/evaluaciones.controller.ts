import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import {
  FiltrosAsignacionMetaDto,
  FiltrosProductividadDto,
  FiltrosSugerirRepartoDto,
  UpsertAsignacionesMetaDto,
} from './dto/asignacion-meta.dto';
import {
  ProductividadPersonaDto,
  ProductividadUsuarioDetalleDto,
  RespuestaAsignacionMetaDto,
  ResumenDesviacionesDto,
  SugerenciaRepartoDto,
} from './dto/respuesta-asignacion.dto';
import { EvaluacionesService } from './evaluaciones.service';

@ApiTags('Evaluaciones')
@ApiBearerAuth('bearer')
@Controller('evaluaciones')
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) {}

  @Post('proyectos/:proyectoId/asignaciones')
  @RequierePermisos('evaluaciones.gestionar')
  @ApiOperation({ summary: 'Crear o actualizar cuotas personales de una meta' })
  @ApiResponse({ status: 201, type: [RespuestaAsignacionMetaDto] })
  upsert(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: UpsertAsignacionesMetaDto,
  ): Promise<RespuestaAsignacionMetaDto[]> {
    return this.evaluacionesService.upsertBatch(proyectoId, dto);
  }

  @Get('proyectos/:proyectoId/asignaciones')
  @RequierePermisos('evaluaciones.ver')
  @ApiOperation({
    summary: 'Listar asignaciones con ejecutado y cumplimiento',
  })
  @ApiResponse({ status: 200, type: [RespuestaAsignacionMetaDto] })
  listar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() filtros: FiltrosAsignacionMetaDto,
  ): Promise<RespuestaAsignacionMetaDto[]> {
    return this.evaluacionesService.listarPorProyecto(proyectoId, filtros);
  }

  @Get('proyectos/:proyectoId/sugerir-reparto')
  @RequierePermisos('evaluaciones.gestionar')
  @ApiOperation({
    summary:
      'Sugerir reparto equitativo entre participantes con jornadas en la meta',
  })
  @ApiResponse({ status: 200, type: [SugerenciaRepartoDto] })
  sugerir(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() query: FiltrosSugerirRepartoDto,
  ): Promise<SugerenciaRepartoDto[]> {
    return this.evaluacionesService.sugerirReparto(
      proyectoId,
      query.metaId,
      query.metaPeriodoId,
    );
  }

  @Get('proyectos/:proyectoId/ranking')
  @RequierePermisos('evaluaciones.ver')
  @ApiOperation({ summary: 'Ranking de productividad del equipo del proyecto' })
  @ApiResponse({ status: 200, type: [ProductividadPersonaDto] })
  rankingProyecto(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() filtros: FiltrosProductividadDto,
  ): Promise<ProductividadPersonaDto[]> {
    return this.evaluacionesService.productividadProyecto(proyectoId, filtros);
  }

  @Get('ranking')
  @RequierePermisos('evaluaciones.ver')
  @ApiOperation({
    summary: 'Ranking global de cumplimiento del equipo (mes actual por defecto)',
  })
  @ApiResponse({ status: 200, type: [ProductividadPersonaDto] })
  rankingGlobal(
    @Query() filtros: FiltrosProductividadDto,
  ): Promise<ProductividadPersonaDto[]> {
    return this.evaluacionesService.cumplimientoEquipoGlobal(
      filtros.anio,
      filtros.mes,
    );
  }

  @Get('usuarios/:usuarioId')
  @RequierePermisos('evaluaciones.ver')
  @ApiOperation({ summary: 'Ficha de evaluación / productividad de un usuario' })
  @ApiResponse({ status: 200, type: ProductividadUsuarioDetalleDto })
  fichaUsuario(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Query() filtros: FiltrosProductividadDto,
  ): Promise<ProductividadUsuarioDetalleDto> {
    return this.evaluacionesService.productividadUsuario(usuarioId, filtros);
  }

  @Get('usuarios/:usuarioId/desviaciones')
  @RequierePermisos('evaluaciones.ver')
  @ApiOperation({
    summary:
      'Desviaciones vs planeación: fallos sin ejecución e incumplimientos del mes',
  })
  @ApiResponse({ status: 200, type: ResumenDesviacionesDto })
  desviaciones(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Query() filtros: FiltrosProductividadDto,
  ): Promise<ResumenDesviacionesDto> {
    return this.evaluacionesService.desviacionesVsPlaneacion(
      usuarioId,
      filtros,
    );
  }
}
