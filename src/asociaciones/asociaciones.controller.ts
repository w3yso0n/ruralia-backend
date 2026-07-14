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
import { AsociacionesService } from './asociaciones.service';
import {
  ActualizarAsociacionDto,
  CrearAsociacionDto,
  FiltrosAsociacionDto,
} from './dto/asociacion.dto';
import {
  RespuestaAsociacionDto,
  RespuestaPaginadaAsociacionesDto,
} from './dto/respuesta-asociacion.dto';

@ApiTags('Asociaciones')
@ApiBearerAuth('bearer')
@Controller('asociaciones')
export class AsociacionesController {
  constructor(private readonly asociacionesService: AsociacionesService) {}

  @Get()
  @RequierePermisos('contrapartes.ver')
  @ApiOperation({ summary: 'Listar asociaciones' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaAsociacionesDto })
  listar(
    @Query() filtros: FiltrosAsociacionDto,
  ): Promise<RespuestaPaginadaAsociacionesDto> {
    return this.asociacionesService.listar(filtros);
  }

  @Get(':id')
  @RequierePermisos('contrapartes.ver')
  @ApiOperation({ summary: 'Obtener una asociación por ID' })
  @ApiResponse({ status: 200, type: RespuestaAsociacionDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaAsociacionDto> {
    return this.asociacionesService.obtenerUno(id);
  }

  @Post()
  @RequierePermisos('contrapartes.crear')
  @ApiOperation({ summary: 'Crear una asociación' })
  @ApiResponse({ status: 201, type: RespuestaAsociacionDto })
  crear(@Body() dto: CrearAsociacionDto): Promise<RespuestaAsociacionDto> {
    return this.asociacionesService.crear(dto);
  }

  @Patch(':id')
  @RequierePermisos('contrapartes.editar')
  @ApiOperation({ summary: 'Actualizar una asociación' })
  @ApiResponse({ status: 200, type: RespuestaAsociacionDto })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAsociacionDto,
  ): Promise<RespuestaAsociacionDto> {
    return this.asociacionesService.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('contrapartes.eliminar')
  @ApiOperation({ summary: 'Desactivar una asociación' })
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.asociacionesService.eliminar(id);
  }
}
