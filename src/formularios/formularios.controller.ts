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
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarPlantillaFormularioDto,
  AsignacionPlantillasProcesoDto,
  AsignarProcesosDto,
  AsignarSubactividadesDto,
  AsignarUsuariosDto,
  ActualizarEnvioFormularioDto,
  CrearPlantillaFormularioDto,
  EnviarFormularioDto,
} from './dto/formulario.dto';
import {
  RespuestaAsignacionPlantillasProcesoDto,
  RespuestaDetalleRespuestaDto,
  RespuestaEnvioFormularioDto,
  RespuestaEnvioPrevioDto,
  RespuestaPlantillaFormularioDto,
} from './dto/respuesta-formulario.dto';
import { EnviosFormularioService } from './envios-formulario.service';
import { PlantillasFormularioService } from './plantillas-formulario.service';

@ApiTags('Formularios')
@ApiBearerAuth('bearer')
@Controller('formularios')
export class FormulariosController {
  constructor(
    private readonly plantillasService: PlantillasFormularioService,
    private readonly enviosService: EnviosFormularioService,
  ) {}

  @Post('plantillas')
  @RequierePermisos('formularios.crear')
  @ApiOperation({ summary: 'Crear una plantilla de formulario' })
  @ApiResponse({ status: 201, type: RespuestaPlantillaFormularioDto })
  crearPlantilla(
    @Body() dto: CrearPlantillaFormularioDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.crear(dto);
  }

  @Get('plantillas')
  @RequierePermisos('formularios.ver')
  @ApiOperation({ summary: 'Listar todas las plantillas de formulario' })
  @ApiResponse({ status: 200, type: [RespuestaPlantillaFormularioDto] })
  listarPlantillas(): Promise<RespuestaPlantillaFormularioDto[]> {
    return this.plantillasService.listarTodas();
  }

  @Get('plantillas/proceso/:procesoId/asignacion')
  @RequierePermisos('formularios.ver')
  @ApiOperation({
    summary:
      'Obtener formulario individual y grupal asignados a un proceso',
  })
  @ApiResponse({ status: 200, type: RespuestaAsignacionPlantillasProcesoDto })
  obtenerAsignacionProceso(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
  ): Promise<RespuestaAsignacionPlantillasProcesoDto> {
    return this.plantillasService.obtenerAsignacionProceso(procesoId);
  }

  @Patch('plantillas/proceso/:procesoId/asignacion')
  @RequierePermisos('formularios.editar')
  @ApiOperation({
    summary: 'Asignar formulario individual y/o grupal a un proceso',
  })
  @ApiResponse({ status: 200, type: RespuestaAsignacionPlantillasProcesoDto })
  asignarPlantillasProceso(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
    @Body() dto: AsignacionPlantillasProcesoDto,
  ): Promise<RespuestaAsignacionPlantillasProcesoDto> {
    return this.plantillasService.asignarPlantillasProceso(procesoId, dto);
  }

  @Get('plantillas/proceso/:procesoId')
  @RequierePermisos('formularios.ver')
  @ApiOperation({ summary: 'Listar plantillas asignadas a un proceso' })
  @ApiResponse({ status: 200, type: [RespuestaPlantillaFormularioDto] })
  listarPlantillasPorProceso(
    @Param('procesoId', ParseUUIDPipe) procesoId: string,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    return this.plantillasService.listarPorProceso(procesoId);
  }

  @Get('plantillas/jornada/:jornadaId')
  @RequierePermisos('formularios.ver')
  @ApiOperation({
    summary:
      'Listar plantillas activas de la jornada (vía meta → proceso + asignadas directamente al usuario)',
  })
  @ApiResponse({ status: 200, type: [RespuestaPlantillaFormularioDto] })
  listarPlantillasPorJornada(
    @Param('jornadaId', ParseUUIDPipe) jornadaId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    return this.plantillasService.listarPorJornada(jornadaId, usuario);
  }

  @Get('plantillas/subactividad/:subactividadId')
  @RequierePermisos('formularios.ver')
  @ApiOperation({ summary: 'Listar plantillas por subactividad' })
  @ApiResponse({ status: 200, type: [RespuestaPlantillaFormularioDto] })
  listarPlantillasPorSubactividad(
    @Param('subactividadId', ParseUUIDPipe) subactividadId: string,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    return this.plantillasService.listarPorSubactividad(subactividadId);
  }

  @Get('plantillas/asignadas')
  @RequierePermisos('formularios.ver')
  @ApiOperation({
    summary:
      'Listar plantillas publicadas asignadas al usuario autenticado (directamente o vía proyectos donde participa)',
  })
  @ApiResponse({ status: 200, type: [RespuestaPlantillaFormularioDto] })
  listarPlantillasAsignadas(
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    return this.plantillasService.listarAsignadasAUsuario(usuario);
  }

  @Get('plantillas/documentos-generales')
  @RequierePermisos('formularios.ver')
  @ApiOperation({
    summary: 'Listar plantillas asignadas directamente al usuario (documentos generales)',
  })
  @ApiResponse({ status: 200, type: [RespuestaPlantillaFormularioDto] })
  listarDocumentosGenerales(
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    return this.plantillasService.listarDocumentosGeneralesAUsuario(usuario);
  }

  @Get('plantillas/:id/envio-previo')
  @RequierePermisos('formularios.ver')
  @ApiOperation({
    summary:
      'Obtener el último envío previo de una plantilla (por jornada o por usuario sin jornada)',
  })
  @ApiResponse({ status: 200, type: RespuestaEnvioPrevioDto })
  obtenerEnvioPrevio(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('jornadaId') jornadaId: string | undefined,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaEnvioPrevioDto> {
    return this.enviosService.obtenerEnvioPrevio(id, usuario, jornadaId);
  }

  @Get('plantillas/:id')
  @RequierePermisos('formularios.ver')
  @ApiOperation({ summary: 'Obtener una plantilla de formulario por ID' })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  obtenerPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.obtenerPorId(id);
  }

  @Patch('plantillas/:id')
  @RequierePermisos('formularios.editar')
  @ApiOperation({ summary: 'Actualizar una plantilla de formulario' })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  actualizarPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPlantillaFormularioDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.actualizar(id, dto);
  }

  @Post('plantillas/:id/publicar')
  @RequierePermisos('formularios.publicar')
  @ApiOperation({ summary: 'Publicar una plantilla de formulario' })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  publicarPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.publicar(id);
  }

  @Post('plantillas/:id/clonar')
  @RequierePermisos('formularios.crear')
  @ApiOperation({ summary: 'Clonar una plantilla (sin subactividades asignadas)' })
  @ApiResponse({ status: 201, type: RespuestaPlantillaFormularioDto })
  clonarPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.clonar(id);
  }

  @Patch('plantillas/:id/procesos')
  @RequierePermisos('formularios.editar')
  @ApiOperation({
    summary: 'Asignar procesos a una plantilla (reemplaza el conjunto)',
  })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  asignarProcesos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarProcesosDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.asignarProcesos(id, dto.procesoIds);
  }

  @Patch('plantillas/:id/subactividades')
  @RequierePermisos('formularios.editar')
  @ApiOperation({
    summary: 'Asignar subactividades a una plantilla (legacy; usar /procesos)',
  })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  asignarSubactividades(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarSubactividadesDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.asignarSubactividades(
      id,
      dto.subactividadIds,
    );
  }

  @Patch('plantillas/:id/usuarios')
  @RequierePermisos('formularios.asignar_usuarios')
  @ApiOperation({
    summary:
      'Asignar usuarios directamente a una plantilla (reemplaza el conjunto)',
  })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  asignarUsuarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarUsuariosDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.asignarUsuarios(id, dto.usuarioIds);
  }

  @Post('envios')
  @RequierePermisos('formularios.enviar')
  @ApiOperation({ summary: 'Enviar un formulario completado' })
  @ApiResponse({ status: 201, type: RespuestaEnvioFormularioDto })
  enviarFormulario(
    @Body() dto: EnviarFormularioDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaEnvioFormularioDto> {
    return this.enviosService.enviar(dto, usuario);
  }

  @Patch('envios/:id')
  @RequierePermisos('formularios.enviar')
  @ApiOperation({ summary: 'Actualizar las respuestas de un envío existente' })
  @ApiResponse({ status: 200, type: RespuestaEnvioFormularioDto })
  actualizarEnvio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEnvioFormularioDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaEnvioFormularioDto> {
    return this.enviosService.actualizar(id, dto, usuario);
  }

  @Get('envios/jornada/:jornadaId')
  @RequierePermisos('formularios.ver')
  @ApiOperation({ summary: 'Listar envíos de formulario por jornada' })
  @ApiResponse({ status: 200, type: [RespuestaEnvioFormularioDto] })
  listarEnviosPorJornada(
    @Param('jornadaId', ParseUUIDPipe) jornadaId: string,
  ): Promise<RespuestaEnvioFormularioDto[]> {
    return this.enviosService.listarPorJornada(jornadaId);
  }

  @Get('envios/:id/respuestas')
  @RequierePermisos('formularios.ver')
  @ApiOperation({ summary: 'Obtener respuestas de un envío de formulario' })
  @ApiResponse({ status: 200, type: [RespuestaDetalleRespuestaDto] })
  obtenerRespuestas(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaDetalleRespuestaDto[]> {
    return this.enviosService.obtenerRespuestas(id);
  }

  @Delete('envios/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('formularios.enviar')
  @ApiOperation({ summary: 'Eliminar un envío (p. ej. quitar asistente de lista grupal)' })
  @ApiResponse({ status: 204 })
  eliminarEnvio(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.enviosService.eliminar(id);
  }
}
