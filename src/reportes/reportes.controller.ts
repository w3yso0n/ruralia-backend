import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { responderFormato } from '../common/utils/responder-formato';
import {
  FiltrosReporteBeneficiariosDto,
  FiltrosSeguimientoDiarioDto,
  FormatoReporteDto,
} from './dto/reportes.dto';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@ApiBearerAuth('bearer')
@RequierePermisos('reportes.ver')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('proyecto/:proyectoId/resumen')
  @ApiOperation({ summary: 'Resumen general del proyecto' })
  @ApiQuery({ name: 'formato', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Resumen del proyecto' })
  async resumenProyecto(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() query: FormatoReporteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const datos = await this.reportesService.resumenProyecto(proyectoId);
    const formato = query.formato ?? 'json';
    const resultado = responderFormato(
      res,
      datos as unknown as Record<string, unknown>,
      formato,
      `resumen-proyecto-${proyectoId}`,
    );
    if (formato !== 'csv') return resultado;
  }

  @Get('proyecto/:proyectoId/beneficiarios')
  @ApiOperation({ summary: 'Reporte de beneficiarios del proyecto' })
  @ApiQuery({ name: 'formato', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Lista de beneficiarios con métricas' })
  async reporteBeneficiarios(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() filtros: FiltrosReporteBeneficiariosDto & FormatoReporteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { formato = 'json', ...filtrosBeneficiarios } = filtros;
    const datos = await this.reportesService.reporteBeneficiarios(
      proyectoId,
      filtrosBeneficiarios,
    );
    const resultado = responderFormato(
      res,
      datos as unknown as Record<string, unknown>[],
      formato,
      `beneficiarios-${proyectoId}`,
    );
    if (formato !== 'csv') return resultado;
  }

  @Get('proyecto/:proyectoId/avance-actividades')
  @ApiOperation({ summary: 'Avance de actividades y subactividades' })
  @ApiQuery({ name: 'formato', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Avance por actividad' })
  async avanceActividades(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() query: FormatoReporteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const datos = await this.reportesService.avanceActividades(proyectoId);
    const formato = query.formato ?? 'json';
    const resultado = responderFormato(
      res,
      datos as unknown as Record<string, unknown>[],
      formato,
      `avance-actividades-${proyectoId}`,
    );
    if (formato !== 'csv') return resultado;
  }

  @Get('proyecto/:proyectoId/mapa-calor')
  @ApiOperation({ summary: 'Mapa de calor territorial por vereda' })
  @ApiQuery({ name: 'formato', required: false, enum: ['json', 'csv'] })
  @ApiResponse({ status: 200, description: 'Datos por vereda con centroide' })
  async mapaCalorTerritorio(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() query: FormatoReporteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const datos = await this.reportesService.mapaCalorTerritorio(proyectoId);
    const formato = query.formato ?? 'json';
    const resultado = responderFormato(
      res,
      datos as unknown as Record<string, unknown>[],
      formato,
      `mapa-calor-${proyectoId}`,
    );
    if (formato !== 'csv') return resultado;
  }

  @Get('proyecto/:proyectoId/seguimiento-excel')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Excel de seguimiento Plan/Ejec mensual (metas, periodos y jornadas)',
  })
  @ApiResponse({ status: 200, description: 'Archivo .xlsx' })
  async excelSeguimiento(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Res() res: Response,
  ) {
    const { buffer, nombreArchivo } =
      await this.reportesService.excelSeguimientoProyecto(proyectoId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreArchivo}"`,
    );
    res.send(buffer);
  }

  @Get('proyecto/:proyectoId/seguimiento-diario-excel')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Excel de seguimiento Plan/Ejec diario de un mes (jornadas por día)',
  })
  @ApiQuery({ name: 'anio', required: false, type: Number })
  @ApiQuery({ name: 'mes', required: false, type: Number, description: '1–12' })
  @ApiResponse({ status: 200, description: 'Archivo .xlsx' })
  async excelSeguimientoDiario(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() query: FiltrosSeguimientoDiarioDto,
    @Res() res: Response,
  ) {
    const ahora = new Date();
    const anio = query.anio ?? ahora.getFullYear();
    const mes = query.mes ?? ahora.getMonth() + 1;

    const { buffer, nombreArchivo } =
      await this.reportesService.excelSeguimientoDiarioProyecto(
        proyectoId,
        anio,
        mes,
      );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreArchivo}"`,
    );
    res.send(buffer);
  }
}
