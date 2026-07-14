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
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto';
import { AsignarPersonalDto } from './dto/asignar-personal.dto';
import { AsignarTerritoriosDto } from './dto/asignar-territorios.dto';
import {
  AsignarAsociacionesProyectoDto,
  AsignarBeneficiariosProyectoDto,
} from './dto/asignar-vinculos.dto';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { FiltrosProyectoDto } from './dto/filtros-proyecto.dto';
import {
  EstadisticasProyectoDto,
  RespuestaPaginadaProyectosDto,
  RespuestaProyectoDto,
} from './dto/respuesta-proyecto.dto';
import { ProyectosService } from './proyectos.service';

@ApiTags('Proyectos')
@ApiBearerAuth('bearer')
@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  @RequierePermisos('proyectos.crear')
  @ApiOperation({ summary: 'Crear un nuevo proyecto' })
  @ApiResponse({ status: 201, type: RespuestaProyectoDto })
  crear(
    @Body() dto: CrearProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.crear(dto, usuario);
  }

  @Get()
  @RequierePermisos('proyectos.ver')
  @ApiOperation({ summary: 'Listar proyectos con filtros y paginación' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaProyectosDto })
  listar(
    @Query() filtros: FiltrosProyectoDto,
  ): Promise<RespuestaPaginadaProyectosDto> {
    return this.proyectosService.listar(filtros);
  }

  @Get(':id/estadisticas')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({ summary: 'Obtener estadísticas de un proyecto' })
  @ApiResponse({ status: 200, type: EstadisticasProyectoDto })
  obtenerEstadisticas(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EstadisticasProyectoDto> {
    return this.proyectosService.obtenerEstadisticas(id);
  }

  @Get(':id')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({ summary: 'Obtener un proyecto por ID' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.obtenerUno(id);
  }

  @Patch(':id')
  @RequierePermisos('proyectos.editar')
  @ApiOperation({ summary: 'Actualizar datos de un proyecto' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.actualizar(id, dto, usuario);
  }

  @Delete(':id/permanente')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('proyectos.eliminar')
  @ApiOperation({ summary: 'Eliminar permanentemente un proyecto' })
  @ApiResponse({ status: 204 })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<void> {
    return this.proyectosService.eliminar(id, usuario);
  }

  @Delete(':id')
  @RequierePermisos('proyectos.eliminar')
  @ApiOperation({ summary: 'Suspender un proyecto' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  suspender(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.suspender(id);
  }

  @Post(':id/activar')
  @RequierePermisos('proyectos.editar')
  @ApiOperation({ summary: 'Activar un proyecto en borrador' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  activar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.activar(id, usuario);
  }

  @Post(':id/territorios')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @ApiOperation({ summary: 'Asignar veredas al proyecto' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  asignarTerritorios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarTerritoriosDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.asignarTerritorios(id, dto, usuario);
  }

  @Post(':id/personal')
  @RequierePermisos('proyectos.asignar_personal')
  @ApiOperation({ summary: 'Asignar personal al proyecto' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  asignarPersonal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarPersonalDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.asignarPersonal(id, dto, usuario);
  }

  @Post(':id/beneficiarios')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @ApiOperation({ summary: 'Asignar beneficiarios al proyecto' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  asignarBeneficiarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarBeneficiariosProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.asignarBeneficiarios(id, dto, usuario);
  }

  @Post(':id/asociaciones')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @ApiOperation({ summary: 'Asignar asociaciones al proyecto' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  asignarAsociaciones(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarAsociacionesProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.asignarAsociaciones(id, dto, usuario);
  }
}
