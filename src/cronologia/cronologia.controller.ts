import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
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

@ApiTags('Cronología')
@ApiBearerAuth('bearer')
@Controller('cronologia')
export class CronologiaController {
  constructor(private readonly cronologiaService: CronologiaService) {}

  @Get('actor/:usuarioId')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({ summary: 'Listar cronología de un actor (paginado)' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaCronologiaDto })
  listarPorActor(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Query() filtros: FiltrosCronologiaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPaginadaCronologiaDto> {
    return this.cronologiaService.listarPorActor(usuarioId, usuario, filtros);
  }

  @Get('proyecto/:proyectoId/resumen')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Resumen agregado del proyecto (totales por acción y por actor) para UI a escala',
  })
  @ApiResponse({ status: 200, type: ResumenCronologiaProyectoDto })
  resumenProyecto(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<ResumenCronologiaProyectoDto> {
    return this.cronologiaService.resumenProyecto(proyectoId, usuario);
  }

  @Get('proyecto/:proyectoId')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Listar cronología de un proyecto (paginado; filtros actor/acción/fechas)',
  })
  @ApiResponse({ status: 200, type: RespuestaPaginadaCronologiaDto })
  listarPorProyecto(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query() filtros: FiltrosCronologiaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPaginadaCronologiaDto> {
    return this.cronologiaService.listarPorProyecto(
      proyectoId,
      usuario,
      filtros,
    );
  }
}
