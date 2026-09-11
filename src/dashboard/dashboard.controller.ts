import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ConfiguracionDashboardService } from './configuracion-dashboard.service';
import { DashboardService } from './dashboard.service';
import { FiltrosDashboardDto } from './dto/filtros-dashboard.dto';
import {
  CumplimientoDashboardDto,
  DashboardCompletoDto,
  JornadaRecienteDashboardDto,
  ProyectoFiltroDashboardDto,
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
  @ApiResponse({ status: 200, type: DashboardCompletoDto })
  obtenerCompleto(
    @Query() filtros: FiltrosDashboardDto,
  ): Promise<DashboardCompletoDto> {
    return this.dashboardService.obtenerCompleto(
      filtros.meses ?? 6,
      filtros.proyectoId,
    );
  }

  @Get('proyectos')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({
    summary: 'Listado liviano de proyectos para filtrar el dashboard',
  })
  @ApiResponse({ status: 200, type: [ProyectoFiltroDashboardDto] })
  listarProyectosFiltro(): Promise<ProyectoFiltroDashboardDto[]> {
    return this.dashboardService.listarProyectosFiltro();
  }

  @Get('reporte/pdf')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({
    summary:
      'Descargar PDF imprimible del reporte operativo (todos los proyectos o uno solo)',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF del dashboard' })
  async descargarPdf(
    @Query() filtros: FiltrosDashboardDto,
    @UsuarioActual() usuario: Usuario,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.dashboardService.generarPdf(
      filtros.proyectoId,
      usuario.nombreCompleto,
    );
    const sufijo = filtros.proyectoId
      ? filtros.proyectoId.slice(0, 8)
      : 'general';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-dashboard-${sufijo}.pdf"`,
    });
    return new StreamableFile(pdf);
  }

  @Get('resumen')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'KPIs principales del dashboard' })
  @ApiResponse({ status: 200, type: ResumenDashboardDto })
  obtenerResumen(
    @Query() filtros: FiltrosDashboardDto,
  ): Promise<ResumenDashboardDto> {
    return this.dashboardService.obtenerResumen(filtros.proyectoId);
  }

  @Get('cumplimiento')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'Medidores de cumplimiento operativo' })
  @ApiResponse({ status: 200, type: CumplimientoDashboardDto })
  obtenerCumplimiento(
    @Query() filtros: FiltrosDashboardDto,
  ): Promise<CumplimientoDashboardDto> {
    return this.dashboardService.obtenerCumplimiento(filtros.proyectoId);
  }

  @Get('actividad-mensual')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'Serie mensual de actividad' })
  @ApiResponse({ status: 200, type: [SerieMensualDashboardDto] })
  obtenerActividadMensual(
    @Query() filtros: FiltrosDashboardDto,
  ): Promise<SerieMensualDashboardDto[]> {
    return this.dashboardService.obtenerActividadMensual(
      filtros.meses ?? 6,
      filtros.proyectoId,
    );
  }

  @Get('mapa-cobertura')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'Veredas con proyectos para mapa de cobertura' })
  @ApiResponse({ status: 200, type: [VeredaCoberturaDto] })
  obtenerMapaCobertura(
    @Query() filtros: FiltrosDashboardDto,
  ): Promise<VeredaCoberturaDto[]> {
    return this.dashboardService.obtenerMapaCobertura(filtros.proyectoId);
  }

  @Get('jornadas-recientes')
  @RequierePermisos('dashboard.ver')
  @ApiOperation({ summary: 'Últimas jornadas registradas' })
  @ApiResponse({ status: 200, type: [JornadaRecienteDashboardDto] })
  obtenerJornadasRecientes(
    @Query() filtros: FiltrosDashboardDto,
  ): Promise<JornadaRecienteDashboardDto[]> {
    return this.dashboardService.obtenerJornadasRecientes(
      filtros.limite ?? 5,
      filtros.proyectoId,
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
