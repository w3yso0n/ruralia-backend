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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AprobacionesService } from './aprobaciones.service';
import {
  AprobarDto,
  EnviarRevisionDto,
  FiltrosBandejaDto,
  GuardarNivelesAprobacionDto,
  ReasignarPasoDto,
  RechazarDto,
  ReenviarRevisionDto,
} from './dto/aprobaciones.dto';
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';

@ApiTags('Aprobaciones')
@ApiBearerAuth('bearer')
@Controller()
export class AprobacionesController {
  constructor(
    private readonly aprobacionesService: AprobacionesService,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

  @Post('jornadas/:id/enviar-revision')
  @RequierePermisos('jornadas.enviar_revision')
  @ApiOperation({
    summary: 'Enviar jornada a revisión (genera documento v1 si aplica)',
  })
  enviarRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarRevisionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.aprobacionesService.enviarARevision(id, usuario, dto.notas);
  }

  @Post('jornadas/:id/subir-proyecto')
  @RequierePermisos('jornadas.enviar_revision')
  @ApiOperation({
    summary:
      'Confirmar jornada sin revisión: pasa a APROBADO y cuenta al avance de la meta',
  })
  subirProyecto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarRevisionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.aprobacionesService.subirAProyecto(id, usuario, dto.notas);
  }

  @Post('jornadas/:id/reenviar-revision')
  @RequierePermisos('jornadas.enviar_revision')
  @ApiOperation({
    summary: 'Reenviar jornada corregida a revisión (nueva versión)',
  })
  reenviarRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReenviarRevisionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.aprobacionesService.reenviarARevision(id, usuario, dto);
  }

  @Post('aprobaciones/aprobar')
  @RequierePermisos('jornadas.aprobar')
  @ApiOperation({
    summary:
      'Aprobar jornada, documento o evidencia (approvedBy solo del token)',
  })
  aprobar(@Body() dto: AprobarDto, @UsuarioActual() usuario: Usuario) {
    return this.aprobacionesService.aprobar(dto, usuario);
  }

  @Post('aprobaciones/rechazar')
  @RequierePermisos('jornadas.rechazar')
  @ApiOperation({
    summary: 'Rechazar con categoría + corrección solicitada obligatoria',
  })
  rechazar(@Body() dto: RechazarDto, @UsuarioActual() usuario: Usuario) {
    return this.aprobacionesService.rechazar(dto, usuario);
  }

  @Get('aprobaciones/bandeja')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Bandeja de trabajo por rol' })
  bandeja(
    @Query() filtros: FiltrosBandejaDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.aprobacionesService.bandeja(usuario, filtros);
  }

  @Get('aprobaciones/contadores')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Contadores para notificaciones internas' })
  contadores(@UsuarioActual() usuario: Usuario) {
    return this.aprobacionesService.contadores(usuario);
  }

  @Post('aprobaciones/jornada/:jornadaId/reasignar')
  @RequierePermisos('proyectos.editar')
  @ApiOperation({
    summary:
      'Reasigna el paso pendiente. Exige alcance sobre el proyecto. Puede asignarse el paso a sí mismo y luego aprobarlo si no es el técnico ni aprobó otro nivel.',
  })
  reasignar(
    @Param('jornadaId', ParseUUIDPipe) jornadaId: string,
    @Body() dto: ReasignarPasoDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.aprobacionesService.reasignarPaso(jornadaId, usuario, dto);
  }

  @Get('aprobaciones/proyecto/:proyectoId/niveles')
  @RequierePermisos('proyectos.configurar_aprobaciones')
  @ApiOperation({ summary: 'Cadena de aprobación configurada en el proyecto' })
  listarNiveles(@Param('proyectoId', ParseUUIDPipe) proyectoId: string) {
    return this.aprobacionesService.listarNiveles(proyectoId);
  }

  @Put('aprobaciones/proyecto/:proyectoId/niveles')
  @RequierePermisos('proyectos.configurar_aprobaciones')
  @ApiOperation({
    summary:
      'Reemplaza la cadena del proyecto y advierte niveles sin candidatos efectivos. No cambia jornadas ya enviadas.',
  })
  guardarNiveles(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: GuardarNivelesAprobacionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.aprobacionesService.guardarNiveles(
      proyectoId,
      usuario,
      dto.niveles,
    );
  }

  @Get('aprobaciones/jornada/:jornadaId/rechazos')
  @RequierePermisos('jornadas.ver')
  async listarRechazos(
    @Param('jornadaId', ParseUUIDPipe) jornadaId: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    await this.alcanceTerritorialService.assertTecnicoEnJornada(
      usuario,
      jornadaId,
    );
    return this.aprobacionesService.rechazosDeJornada(jornadaId);
  }

  @Get('aprobaciones/jornada/:jornadaId/aprobaciones')
  @RequierePermisos('jornadas.ver')
  async listarAprobaciones(
    @Param('jornadaId', ParseUUIDPipe) jornadaId: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    await this.alcanceTerritorialService.assertTecnicoEnJornada(
      usuario,
      jornadaId,
    );
    return this.aprobacionesService.aprobacionesDeJornada(jornadaId);
  }
}
