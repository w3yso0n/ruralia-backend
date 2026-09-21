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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import {
  ActualizarGeocercaDto,
  CrearGeocercaDto,
  RespuestaGeocercaDto,
} from './dto/geocerca.dto';
import { GeocercasService } from './geocercas.service';

@ApiTags('Proyectos')
@ApiBearerAuth('bearer')
@Controller('proyectos/:proyectoId/geocercas')
export class GeocercasController {
  constructor(private readonly geocercasService: GeocercasService) {}

  @Get()
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary: 'Listar geocercas del proyecto',
    description:
      'Zonas poligonales trazadas con puntos de latitud/longitud, propias de cada proyecto.',
  })
  @ApiResponse({ status: 200, type: [RespuestaGeocercaDto] })
  listar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
  ): Promise<RespuestaGeocercaDto[]> {
    return this.geocercasService.listar(proyectoId);
  }

  @Get(':geocercaId')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({ summary: 'Obtener una geocerca del proyecto' })
  @ApiResponse({ status: 200, type: RespuestaGeocercaDto })
  obtenerUno(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('geocercaId', ParseUUIDPipe) geocercaId: string,
  ): Promise<RespuestaGeocercaDto> {
    return this.geocercasService.obtenerUno(proyectoId, geocercaId);
  }

  @Post()
  @RequierePermisos('proyectos.editar')
  @ApiOperation({
    summary: 'Crear una geocerca',
    description:
      'Define una zona con al menos 3 puntos (latitud y longitud). El polígono se cierra automáticamente.',
  })
  @ApiResponse({ status: 201, type: RespuestaGeocercaDto })
  crear(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: CrearGeocercaDto,
  ): Promise<RespuestaGeocercaDto> {
    return this.geocercasService.crear(proyectoId, dto);
  }

  @Patch(':geocercaId')
  @RequierePermisos('proyectos.editar')
  @ApiOperation({ summary: 'Actualizar una geocerca del proyecto' })
  @ApiResponse({ status: 200, type: RespuestaGeocercaDto })
  actualizar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('geocercaId', ParseUUIDPipe) geocercaId: string,
    @Body() dto: ActualizarGeocercaDto,
  ): Promise<RespuestaGeocercaDto> {
    return this.geocercasService.actualizar(proyectoId, geocercaId, dto);
  }

  @Delete(':geocercaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('proyectos.editar')
  @ApiOperation({ summary: 'Eliminar una geocerca del proyecto' })
  @ApiResponse({ status: 204 })
  eliminar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('geocercaId', ParseUUIDPipe) geocercaId: string,
  ): Promise<void> {
    return this.geocercasService.eliminar(proyectoId, geocercaId);
  }
}
