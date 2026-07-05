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
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RolEnum } from '../autenticacion/enums/rol.enum';
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
  @ApiOperation({ summary: 'Listar asociaciones' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaAsociacionesDto })
  listar(
    @Query() filtros: FiltrosAsociacionDto,
  ): Promise<RespuestaPaginadaAsociacionesDto> {
    return this.asociacionesService.listar(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una asociación por ID' })
  @ApiResponse({ status: 200, type: RespuestaAsociacionDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaAsociacionDto> {
    return this.asociacionesService.obtenerUno(id);
  }

  @Post()
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Crear una asociación' })
  @ApiResponse({ status: 201, type: RespuestaAsociacionDto })
  crear(@Body() dto: CrearAsociacionDto): Promise<RespuestaAsociacionDto> {
    return this.asociacionesService.crear(dto);
  }

  @Patch(':id')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
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
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Desactivar una asociación' })
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.asociacionesService.eliminar(id);
  }
}
