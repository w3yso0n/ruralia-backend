import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AprobacionesService } from './aprobaciones.service';
import {
  AprobarDto,
  EnviarRevisionDto,
  FiltrosBandejaDto,
  RechazarDto,
  ReenviarRevisionDto,
} from './dto/aprobaciones.dto';

@ApiTags('Aprobaciones')
@ApiBearerAuth('bearer')
@Controller()
export class AprobacionesController {
  constructor(private readonly aprobacionesService: AprobacionesService) {}

  @Post('jornadas/:id/enviar-revision')
  @RequierePermisos('jornadas.enviar_revision')
  @ApiOperation({ summary: 'Enviar jornada a revisión (genera documento v1 si aplica)' })
  enviarRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarRevisionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.aprobacionesService.enviarARevision(id, usuario, dto.notas);
  }

  @Post('jornadas/:id/reenviar-revision')
  @RequierePermisos('jornadas.enviar_revision')
  @ApiOperation({ summary: 'Reenviar jornada corregida a revisión (nueva versión)' })
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
    summary: 'Aprobar jornada, documento o evidencia (approvedBy solo del token)',
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

  @Get('aprobaciones/jornada/:jornadaId/rechazos')
  @RequierePermisos('jornadas.ver')
  listarRechazos(@Param('jornadaId', ParseUUIDPipe) jornadaId: string) {
    return this.aprobacionesService.rechazosDeJornada(jornadaId);
  }

  @Get('aprobaciones/jornada/:jornadaId/aprobaciones')
  @RequierePermisos('jornadas.ver')
  listarAprobaciones(@Param('jornadaId', ParseUUIDPipe) jornadaId: string) {
    return this.aprobacionesService.aprobacionesDeJornada(jornadaId);
  }
}
