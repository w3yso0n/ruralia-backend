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
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RolEnum } from '../autenticacion/enums/rol.enum';
import { responderFormato } from '../common/utils/responder-formato';
import {
  FiltrosReporteBeneficiariosDto,
  FormatoReporteDto,
} from './dto/reportes.dto';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@ApiBearerAuth('bearer')
@Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
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
}
