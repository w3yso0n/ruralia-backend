import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { DashboardService } from './dashboard.service';
import {
  CumplimientoDashboardDto,
  DashboardCompletoDto,
  ResumenDashboardDto,
  SerieMensualDashboardDto,
  VeredaCoberturaDto,
} from './dto/respuesta-dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('bearer')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @RequierePermisos('dashboard.ver')
  @ApiOperation({
    summary: 'Dashboard completo (KPIs, medidores, series, mapas)',
  })
  @ApiQuery({ name: 'meses', required: false, type: Number })
  @ApiResponse({ status: 200, type: DashboardCompletoDto })
  obtenerCompleto(
    @Query('meses') meses?: string,
  ): Promise<DashboardCompletoDto> {
    const n = meses ? Number(meses) : 6;
    return this.dashboardService.obtenerCompleto(
      Number.isFinite(n) && n > 0 ? Math.min(n, 24) : 6,
    );
  }

  @Get('resumen')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'KPIs principales del dashboard' })
  @ApiResponse({ status: 200, type: ResumenDashboardDto })
  obtenerResumen(): Promise<ResumenDashboardDto> {
    return this.dashboardService.obtenerResumen();
  }

  @Get('cumplimiento')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'Medidores de cumplimiento operativo' })
  @ApiResponse({ status: 200, type: CumplimientoDashboardDto })
  obtenerCumplimiento(): Promise<CumplimientoDashboardDto> {
    return this.dashboardService.obtenerCumplimiento();
  }

  @Get('actividad-mensual')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'Serie mensual de actividad' })
  @ApiQuery({ name: 'meses', required: false, type: Number })
  @ApiResponse({ status: 200, type: [SerieMensualDashboardDto] })
  obtenerActividadMensual(
    @Query('meses') meses?: string,
  ): Promise<SerieMensualDashboardDto[]> {
    const n = meses ? Number(meses) : 6;
    return this.dashboardService.obtenerActividadMensual(
      Number.isFinite(n) && n > 0 ? Math.min(n, 24) : 6,
    );
  }

  @Get('mapa-cobertura')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'Veredas con proyectos para mapa de cobertura' })
  @ApiResponse({ status: 200, type: [VeredaCoberturaDto] })
  obtenerMapaCobertura(): Promise<VeredaCoberturaDto[]> {
    return this.dashboardService.obtenerMapaCobertura();
  }
}
