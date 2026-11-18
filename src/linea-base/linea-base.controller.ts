import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  AltaRapidaBeneficiarioDto,
  AsignarLineaBaseDto,
  ConfigurarLineaBaseDto,
  EstadoLineaBaseProyectoDto,
  FilaBeneficiarioLineaBaseDto,
  FiltrosBeneficiariosLineaBaseDto,
  PaginaBeneficiariosLineaBaseDto,
  ResultadoAsignacionLineaBaseDto,
} from './dto/linea-base.dto';
import { LineaBaseService } from './linea-base.service';

@ApiTags('Línea base')
@ApiBearerAuth('bearer')
@Controller('proyectos/:proyectoId/linea-base')
export class LineaBaseController {
  constructor(private readonly lineaBaseService: LineaBaseService) {}

  @Get()
  @RequierePermisos('linea_base.ver')
  @ApiOperation({
    summary:
      'Formulario de línea base del proyecto y avance informativo (no alimenta métricas)',
  })
  @ApiResponse({ status: 200, type: EstadoLineaBaseProyectoDto })
  obtenerEstado(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<EstadoLineaBaseProyectoDto> {
    return this.lineaBaseService.obtenerEstado(proyectoId, usuario);
  }

  @Put('configuracion')
  @RequierePermisos('linea_base.asignar')
  @ApiOperation({
    summary: 'Elegir el formulario de línea base activo del proyecto',
  })
  @ApiResponse({ status: 200, type: EstadoLineaBaseProyectoDto })
  configurar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: ConfigurarLineaBaseDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<EstadoLineaBaseProyectoDto> {
    return this.lineaBaseService.configurar(proyectoId, dto, usuario);
  }

  @Get('beneficiarios')
  @RequierePermisos('linea_base.ver')
  @ApiOperation({
    summary: 'Beneficiarios del proyecto con su estado de línea base',
  })
  @ApiResponse({ status: 200, type: PaginaBeneficiariosLineaBaseDto })
  listarBeneficiarios(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() filtros: FiltrosBeneficiariosLineaBaseDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<PaginaBeneficiariosLineaBaseDto> {
    return this.lineaBaseService.listarBeneficiarios(
      proyectoId,
      filtros,
      usuario,
    );
  }

  @Post('beneficiarios')
  @RequierePermisos('linea_base.asignar')
  @ApiOperation({
    summary:
      'Alta rápida (nombre y documento). Si la cédula ya existe, se vincula esa persona.',
  })
  @ApiResponse({ status: 201, type: FilaBeneficiarioLineaBaseDto })
  altaRapida(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: AltaRapidaBeneficiarioDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<FilaBeneficiarioLineaBaseDto> {
    return this.lineaBaseService.altaRapida(proyectoId, dto, usuario);
  }

  @Get('beneficiarios/:beneficiarioId/historial')
  @RequierePermisos('linea_base.ver')
  @ApiOperation({
    summary: 'Cambios de datos del beneficiario aplicados desde línea base',
  })
  historialBeneficiario(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('beneficiarioId', ParseUUIDPipe) beneficiarioId: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.lineaBaseService.historialBeneficiario(
      proyectoId,
      beneficiarioId,
      usuario,
    );
  }

  @Post('jornadas')
  @RequierePermisos('linea_base.asignar')
  @ApiOperation({
    summary:
      'Asignar línea base: una jornada individual por beneficiario con el técnico indicado',
  })
  @ApiResponse({ status: 201, type: ResultadoAsignacionLineaBaseDto })
  asignar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: AsignarLineaBaseDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<ResultadoAsignacionLineaBaseDto> {
    return this.lineaBaseService.asignar(proyectoId, dto, usuario);
  }

  @Get('jornadas/:jornadaId')
  @RequierePermisos('linea_base.ver')
  @ApiOperation({
    summary:
      'Respuestas, versiones y cambios aplicados de una jornada de línea base',
  })
  detalleJornada(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('jornadaId', ParseUUIDPipe) jornadaId: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.lineaBaseService.detalleJornada(proyectoId, jornadaId, usuario);
  }
}
