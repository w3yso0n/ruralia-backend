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
  Query,
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
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  FiltrosLineasProductivasDto,
  RenombrarLineaProductivaDto,
  RespuestaAdministracionLineasDto,
  RespuestaBeneficiarioLineaDto,
  RespuestaLineaProductivaDto,
  RespuestaLineaProyectoDto,
  RespuestaUnificarLineasDto,
  UnificarLineasProductivasDto,
} from './dto/linea-productiva.dto';
import { LineasProductivasService } from './lineas-productivas.service';

export const PERMISO_ADMINISTRAR_LINEAS = 'lineas_productivas.administrar';

@ApiTags('Líneas productivas')
@ApiBearerAuth('bearer')
@Controller()
export class LineasProductivasController {
  constructor(private readonly lineasService: LineasProductivasService) {}

  @Get('lineas-productivas')
  @SoloAutenticado()
  @ApiOperation({
    summary:
      'Buscar en el catálogo (selectores de beneficiario y subactividad). Crear una línea nueva ocurre al guardar el beneficiario o la subactividad.',
  })
  @ApiResponse({ status: 200, type: [RespuestaLineaProductivaDto] })
  buscar(
    @Query() filtros: FiltrosLineasProductivasDto,
  ): Promise<RespuestaLineaProductivaDto[]> {
    return this.lineasService.buscar(filtros.busqueda, filtros.limite);
  }

  @Get('lineas-productivas/administracion')
  @RequierePermisos(PERMISO_ADMINISTRAR_LINEAS)
  @ApiOperation({
    summary: 'Catálogo con conteos de uso y posibles duplicados',
  })
  @ApiResponse({ status: 200, type: RespuestaAdministracionLineasDto })
  listarAdministracion(): Promise<RespuestaAdministracionLineasDto> {
    return this.lineasService.listarAdministracion();
  }

  @Post('lineas-productivas/unificar')
  @RequierePermisos(PERMISO_ADMINISTRAR_LINEAS)
  @ApiOperation({
    summary:
      'Junta varias líneas en una: actualiza beneficiarios y subactividades y borra las demás',
  })
  @ApiResponse({ status: 201, type: RespuestaUnificarLineasDto })
  unificar(
    @Body() dto: UnificarLineasProductivasDto,
  ): Promise<RespuestaUnificarLineasDto> {
    return this.lineasService.unificar(dto.destinoId, dto.origenIds);
  }

  @Patch('lineas-productivas/:id')
  @RequierePermisos(PERMISO_ADMINISTRAR_LINEAS)
  @ApiOperation({
    summary: 'Renombrar una línea (se refleja en todos sus beneficiarios)',
  })
  @ApiResponse({ status: 200, type: RespuestaLineaProductivaDto })
  renombrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenombrarLineaProductivaDto,
  ): Promise<RespuestaLineaProductivaDto> {
    return this.lineasService.renombrar(id, dto.nombre);
  }

  @Delete('lineas-productivas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos(PERMISO_ADMINISTRAR_LINEAS)
  @ApiOperation({ summary: 'Eliminar una línea sin uso' })
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.lineasService.eliminar(id);
  }

  @Get('proyectos/:proyectoId/lineas-productivas')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary: 'Líneas de los beneficiarios activos del proyecto, con su conteo',
  })
  @ApiResponse({ status: 200, type: [RespuestaLineaProyectoDto] })
  listarDeProyecto(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaLineaProyectoDto[]> {
    return this.lineasService.listarDeProyecto(proyectoId, usuario);
  }

  @Get('proyectos/:proyectoId/lineas-productivas/disponibles')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Líneas con beneficiarios del catálogo que aún no están en el proyecto (solo agrícolas)',
  })
  @ApiResponse({ status: 200, type: [RespuestaLineaProyectoDto] })
  listarDisponibles(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaLineaProyectoDto[]> {
    return this.lineasService.listarDisponiblesParaProyecto(
      proyectoId,
      usuario,
    );
  }

  @Get('proyectos/:proyectoId/lineas-productivas/:lineaId/disponibles')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary: 'Beneficiarios de esa línea que se pueden sumar al proyecto',
  })
  @ApiResponse({ status: 200, type: [RespuestaBeneficiarioLineaDto] })
  disponiblesDeLinea(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('lineaId', ParseUUIDPipe) lineaId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaBeneficiarioLineaDto[]> {
    return this.lineasService.disponiblesDeLinea(proyectoId, lineaId, usuario);
  }

  @Get('proyectos/:proyectoId/lineas-productivas/:lineaId/beneficiarios')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Beneficiarios activos del proyecto con esa línea (para agregarlos en lote)',
  })
  @ApiResponse({ status: 200, type: [RespuestaBeneficiarioLineaDto] })
  beneficiariosDeLinea(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('lineaId', ParseUUIDPipe) lineaId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaBeneficiarioLineaDto[]> {
    return this.lineasService.beneficiariosDeLinea(
      proyectoId,
      lineaId,
      usuario,
    );
  }
}
