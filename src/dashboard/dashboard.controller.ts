import { Body, Controller, Get, Put, Post, Query } from '@nestjs/common';
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
import { ConfiguracionDashboardService } from './configuracion-dashboard.service';
import { DashboardService } from './dashboard.service';
import {
  CumplimientoDashboardDto,
  DashboardCompletoDto,
  JornadaRecienteDashboardDto,
  ResumenDashboardDto,
  SerieMensualDashboardDto,
  VeredaCoberturaDto,
} from './dto/respuesta-dashboard.dto';
import {
  ActualizarConfiguracionDashboardDto,
  ConfiguracionDashboardDto,
  WidgetDisponibleDto,
} from './dto/widget-dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('bearer')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly configuracionDashboardService: ConfiguracionDashboardService,
  ) {}

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

  @Get('jornadas-recientes')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'Últimas jornadas registradas' })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  @ApiResponse({ status: 200, type: [JornadaRecienteDashboardDto] })
  obtenerJornadasRecientes(
    @Query('limite') limite?: string,
  ): Promise<JornadaRecienteDashboardDto[]> {
    const n = limite ? Number(limite) : 5;
    return this.dashboardService.obtenerJornadasRecientes(
      Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 5,
    );
  }

  @Get('widgets-disponibles')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({
    summary:
      'Catálogo de widgets que el usuario puede ver/agregar (según sus permisos). Solo lectura: no requiere permiso de edición, lo usan tanto quien personaliza su propio dashboard como quien diseña plantillas para otros roles.',
  })
  @ApiResponse({ status: 200, type: [WidgetDisponibleDto] })
  obtenerWidgetsDisponibles(
    @UsuarioActual() usuario: Usuario,
  ): Promise<WidgetDisponibleDto[]> {
    return this.configuracionDashboardService.obtenerDisponibles(usuario);
  }

  @Get('mi-configuracion')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'Layout personalizado del usuario autenticado' })
  @ApiResponse({ status: 200, type: ConfiguracionDashboardDto })
  obtenerMiConfiguracion(
    @UsuarioActual() usuario: Usuario,
  ): Promise<ConfiguracionDashboardDto> {
    // Solo requiere dashboard.ver (no configuracion.editar_dashboard): el
    // dashboard real también depende de este endpoint para saber qué pintar.
    return this.configuracionDashboardService.obtenerConfiguracion(usuario);
  }

  @Put('mi-configuracion')
  @RequierePermisos('configuracion.editar_dashboard')
  @ApiOperation({ summary: 'Guarda el layout personalizado del usuario' })
  @ApiResponse({ status: 200, type: ConfiguracionDashboardDto })
  actualizarMiConfiguracion(
    @UsuarioActual() usuario: Usuario,
    @Body() dto: ActualizarConfiguracionDashboardDto,
  ): Promise<ConfiguracionDashboardDto> {
    return this.configuracionDashboardService.actualizarConfiguracion(
      usuario,
      dto,
    );
  }

  @Post('mi-configuracion/restablecer')
  @RequierePermisos('configuracion.editar_dashboard')
  @ApiOperation({ summary: 'Restablece el layout de fábrica del usuario' })
  @ApiResponse({ status: 200, type: ConfiguracionDashboardDto })
  restablecerMiConfiguracion(
    @UsuarioActual() usuario: Usuario,
  ): Promise<ConfiguracionDashboardDto> {
    return this.configuracionDashboardService.restablecerConfiguracion(usuario);
  }
}
