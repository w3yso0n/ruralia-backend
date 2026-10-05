import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CronologiaService } from './cronologia.service';
import { FiltrosCronologiaDto } from './dto/filtros-cronologia.dto';
import {
  RespuestaPaginadaCronologiaDto,
  ResumenCronologiaProyectoDto,
} from './dto/respuesta-cronologia.dto';
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { usuarioSoloJornadasAsignadas } from '../usuarios/utils/permisos-usuario';

@ApiTags('Cronología')
@ApiBearerAuth('bearer')
@Controller('cronologia')
export class CronologiaController {
  constructor(
    private readonly cronologiaService: CronologiaService,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

  @Get('actores')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Listar agentes de campo visibles para seguimiento (sin exigir usuarios.ver)',
  })
  listarActores(@UsuarioActual() usuario: Usuario) {
    // El técnico no hace seguimiento de otros agentes.
    if (usuarioSoloJornadasAsignadas(usuario)) return [];
    return this.cronologiaService.listarActoresVisibles(usuario);
  }

  @Get('actor/:usuarioId')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({ summary: 'Listar cronología de un actor (paginado)' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaCronologiaDto })
  listarPorActor(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Query() filtros: FiltrosCronologiaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPaginadaCronologiaDto> {
    if (usuarioSoloJornadasAsignadas(usuario) && usuarioId !== usuario.id) {
      throw new ForbiddenException('Solo puedes consultar tu propia actividad');
    }
    return this.cronologiaService.listarPorActor(usuarioId, usuario, filtros);
  }

  @Get('proyecto/:proyectoId/resumen')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Resumen agregado del proyecto (totales por acción y por actor) para UI a escala',
  })
  @ApiResponse({ status: 200, type: ResumenCronologiaProyectoDto })
  async resumenProyecto(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<ResumenCronologiaProyectoDto> {
    await this.alcanceTerritorialService.assertConsultaCompletaProyecto(
      usuario,
      proyectoId,
    );
    return this.cronologiaService.resumenProyecto(proyectoId, usuario);
  }

  @Get('proyecto/:proyectoId')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Listar cronología de un proyecto (paginado; filtros actor/acción/fechas)',
  })
  @ApiResponse({ status: 200, type: RespuestaPaginadaCronologiaDto })
  async listarPorProyecto(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() filtros: FiltrosCronologiaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPaginadaCronologiaDto> {
    await this.alcanceTerritorialService.assertConsultaCompletaProyecto(
      usuario,
      proyectoId,
    );
    return this.cronologiaService.listarPorProyecto(
      proyectoId,
      usuario,
      filtros,
    );
  }
}
