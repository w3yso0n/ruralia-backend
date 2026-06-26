import {
  Body,
  Controller,
  Delete,
  Get,
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
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { RolEnum } from '../autenticacion/enums/rol.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto';
import { AsignarPersonalDto } from './dto/asignar-personal.dto';
import { AsignarTerritoriosDto } from './dto/asignar-territorios.dto';
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
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Crear un nuevo proyecto' })
  @ApiResponse({ status: 201, type: RespuestaProyectoDto })
  crear(
    @Body() dto: CrearProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.crear(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proyectos con filtros y paginación' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaProyectosDto })
  listar(
    @Query() filtros: FiltrosProyectoDto,
  ): Promise<RespuestaPaginadaProyectosDto> {
    return this.proyectosService.listar(filtros);
  }

  @Get(':id/estadisticas')
  @ApiOperation({ summary: 'Obtener estadísticas de un proyecto' })
  @ApiResponse({ status: 200, type: EstadisticasProyectoDto })
  obtenerEstadisticas(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EstadisticasProyectoDto> {
    return this.proyectosService.obtenerEstadisticas(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un proyecto por ID' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.obtenerUno(id);
  }

  @Patch(':id')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Actualizar datos de un proyecto' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.actualizar(id, dto, usuario);
  }

  @Delete(':id')
  @Roles(RolEnum.ADMINISTRADOR)
  @ApiOperation({ summary: 'Suspender un proyecto' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  suspender(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.suspender(id);
  }

  @Post(':id/territorios')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
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
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Asignar personal al proyecto' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  asignarPersonal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarPersonalDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.asignarPersonal(id, dto, usuario);
  }
}
