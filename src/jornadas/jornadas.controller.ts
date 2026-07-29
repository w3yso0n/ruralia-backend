import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
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
import {
  ActualizarAsistenteJornadaDto,
  CrearAsistenteJornadaDto,
  GuardarAsistenciaJornadaDto,
  RespuestaAsistenteJornadaDto,
} from './dto/asistencia-jornada.dto';
import {
  ActualizarJornadaDto,
  AgregarBeneficiariosDto,
  AgregarMiembroEquipoDto,
  CambiarEstadoJornadaDto,
  CrearJornadaDto,
} from './dto/jornada.dto';
import { FiltrosJornadaDto } from './dto/filtros-jornada.dto';
import { FiltrosJornadaAsignadaDto } from './dto/filtros-jornada-asignada.dto';
import {
  ResumenJornadaDto,
  RespuestaCrearJornadasDto,
  RespuestaJornadaDto,
  RespuestaPaginadaJornadasDto,
} from './dto/respuesta-jornada.dto';
import { JornadasService } from './jornadas.service';

@ApiTags('Jornadas')
@ApiBearerAuth('bearer')
@Controller('jornadas')
export class JornadasController {
  constructor(private readonly jornadasService: JornadasService) {}

  @Post()
  @RequierePermisos('jornadas.crear')
  @ApiOperation({ summary: 'Crear una o más jornadas (una por agente)' })
  @ApiResponse({ status: 201, type: RespuestaCrearJornadasDto })
  crear(
    @Body() dto: CrearJornadaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaCrearJornadasDto> {
    return this.jornadasService.crear(dto, usuario);
  }

  @Get()
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Listar jornadas con filtros y paginación' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaJornadasDto })
  listar(
    @Query() filtros: FiltrosJornadaDto,
  ): Promise<RespuestaPaginadaJornadasDto> {
    return this.jornadasService.listar(filtros);
  }

  @Get('asignadas')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({
    summary:
      'Listar jornadas asignadas al usuario autenticado (responsable o equipo)',
  })
  @ApiResponse({ status: 200, type: RespuestaPaginadaJornadasDto })
  listarAsignadas(
    @Query() filtros: FiltrosJornadaAsignadaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPaginadaJornadasDto> {
    return this.jornadasService.listarAsignadasAUsuario(usuario, filtros);
  }

  @Get(':id/resumen')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Obtener resumen de una jornada' })
  @ApiResponse({ status: 200, type: ResumenJornadaDto })
  obtenerResumen(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResumenJornadaDto> {
    return this.jornadasService.obtenerResumen(id);
  }

  @Get(':id/asistencia/pdf')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({
    summary: 'Descargar PDF de lista de asistencia (jornada grupal)',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF de asistencia' })
  async descargarPdfAsistencia(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.jornadasService.generarPdfAsistencia(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="asistencia-jornada-${id.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(pdf);
  }

  @Get(':id/formulario/pdf')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({
    summary:
      'Descargar PDF con respuestas del formulario (jornada individual)',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF de formulario' })
  async descargarPdfFormulario(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.jornadasService.generarPdfFormulario(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="formulario-jornada-${id.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(pdf);
  }

  @Get(':id/asistencia')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Listar asistentes de una jornada grupal' })
  @ApiResponse({ status: 200, type: [RespuestaAsistenteJornadaDto] })
  listarAsistencia(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaAsistenteJornadaDto[]> {
    return this.jornadasService.listarAsistencia(id);
  }

  @Put(':id/asistencia')
  @RequierePermisos('jornadas.editar')
  @ApiOperation({
    summary: 'Reemplazar la lista completa de asistencia de una jornada grupal',
  })
  @ApiResponse({ status: 200, type: [RespuestaAsistenteJornadaDto] })
  guardarAsistencia(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuardarAsistenciaJornadaDto,
  ): Promise<RespuestaAsistenteJornadaDto[]> {
    return this.jornadasService.guardarAsistencia(id, dto);
  }

  @Post(':id/asistencia')
  @RequierePermisos('jornadas.editar')
  @ApiOperation({ summary: 'Agregar un asistente a la lista de asistencia' })
  @ApiResponse({ status: 201, type: RespuestaAsistenteJornadaDto })
  agregarAsistente(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearAsistenteJornadaDto,
  ): Promise<RespuestaAsistenteJornadaDto> {
    return this.jornadasService.agregarAsistente(id, dto);
  }

  @Patch(':id/asistencia/:asistenteId')
  @RequierePermisos('jornadas.editar')
  @ApiOperation({
    summary: 'Actualizar nombre, documento o firma de un asistente',
  })
  @ApiResponse({ status: 200, type: RespuestaAsistenteJornadaDto })
  actualizarAsistente(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('asistenteId', ParseUUIDPipe) asistenteId: string,
    @Body() dto: ActualizarAsistenteJornadaDto,
  ): Promise<RespuestaAsistenteJornadaDto> {
    return this.jornadasService.actualizarAsistente(id, asistenteId, dto);
  }

  @Delete(':id/asistencia/:asistenteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('jornadas.editar')
  @ApiOperation({ summary: 'Eliminar un asistente de la lista' })
  @ApiResponse({ status: 204 })
  eliminarAsistente(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('asistenteId', ParseUUIDPipe) asistenteId: string,
  ): Promise<void> {
    return this.jornadasService.eliminarAsistente(id, asistenteId);
  }

  @Get(':id')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Obtener una jornada por ID' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  obtenerUna(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.obtenerUna(id);
  }

  @Patch(':id')
  @RequierePermisos('jornadas.editar')
  @ApiOperation({ summary: 'Actualizar datos de una jornada' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarJornadaDto,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @RequierePermisos('jornadas.cambiar_estado')
  @ApiOperation({ summary: 'Cambiar el estado de una jornada' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoJornadaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.cambiarEstado(id, dto, usuario);
  }

  @Post(':id/beneficiarios')
  @RequierePermisos('jornadas.editar')
  @ApiOperation({ summary: 'Agregar beneficiarios a una jornada' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  agregarBeneficiarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AgregarBeneficiariosDto,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.agregarBeneficiarios(id, dto);
  }

  @Post(':id/equipo')
  @RequierePermisos('jornadas.editar')
  @ApiOperation({ summary: 'Agregar un miembro al equipo de la jornada' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  agregarMiembroEquipo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AgregarMiembroEquipoDto,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.agregarMiembroEquipo(id, dto);
  }

  @Delete(':id/permanente')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('jornadas.eliminar')
  @ApiOperation({ summary: 'Eliminar permanentemente una jornada' })
  @ApiResponse({ status: 204 })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force', new ParseBoolPipe({ optional: true })) force?: boolean,
  ): Promise<void> {
    return this.jornadasService.eliminar(id, force ?? false);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequierePermisos('jornadas.eliminar')
  @ApiOperation({ summary: 'Cancelar una jornada' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.cancelar(id, usuario);
  }
}
