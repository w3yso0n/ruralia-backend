import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  CrearIndicadorDto,
  RangoFechasIndicadorDto,
  RegistrarValorIndicadorDto,
} from './dto/indicador.dto';
import {
  AvanceIndicadorDto,
  PuntoLineaTiempoDto,
  RespuestaIndicadorDto,
  RespuestaRegistroIndicadorDto,
} from './dto/respuesta-indicador.dto';
import { IndicadoresService } from './indicadores.service';

@ApiTags('Indicadores')
@ApiBearerAuth('bearer')
@Controller('indicadores')
export class IndicadoresController {
  constructor(private readonly indicadoresService: IndicadoresService) {}

  @Post()
  @RequierePermisos('indicadores.crear')
  @ApiOperation({ summary: 'Crear indicador y asociarlo a proyectos' })
  @ApiResponse({ status: 201, type: RespuestaIndicadorDto })
  crear(@Body() dto: CrearIndicadorDto): Promise<RespuestaIndicadorDto> {
    return this.indicadoresService.crear(dto);
  }

  @Get()
  @RequierePermisos('indicadores.ver')
  @ApiOperation({ summary: 'Listar todos los indicadores' })
  @ApiResponse({ status: 200, type: [RespuestaIndicadorDto] })
  listar(): Promise<RespuestaIndicadorDto[]> {
    return this.indicadoresService.listar();
  }

  @Get('proyecto/:proyectoId/avance')
  @RequierePermisos('indicadores.ver')
  @ApiOperation({ summary: 'Obtener avance de indicadores por proyecto' })
  @ApiResponse({ status: 200, type: [AvanceIndicadorDto] })
  obtenerAvance(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
  ): Promise<AvanceIndicadorDto[]> {
    return this.indicadoresService.obtenerAvance(proyectoId);
  }

  @Get(':id/linea-tiempo')
  @RequierePermisos('indicadores.ver')
  @ApiOperation({ summary: 'Serie temporal de registros de un indicador' })
  @ApiResponse({ status: 200, type: [PuntoLineaTiempoDto] })
  obtenerLineaTiempo(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() rango: RangoFechasIndicadorDto,
  ): Promise<PuntoLineaTiempoDto[]> {
    return this.indicadoresService.obtenerLineaTiempo(id, rango);
  }

  @Get(':id')
  @RequierePermisos('indicadores.ver')
  @ApiOperation({ summary: 'Obtener un indicador por ID' })
  @ApiResponse({ status: 200, type: RespuestaIndicadorDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaIndicadorDto> {
    return this.indicadoresService.obtenerUno(id);
  }

  @Post(':id/registros')
  @RequierePermisos('indicadores.crear')
  @ApiOperation({ summary: 'Registrar valor de un indicador en una jornada' })
  @ApiResponse({ status: 201, type: RespuestaRegistroIndicadorDto })
  registrarValor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarValorIndicadorDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaRegistroIndicadorDto> {
    return this.indicadoresService.registrarValor(id, dto, usuario);
  }
}
