import {
  Body,
  Controller,
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
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarJornadaDto,
  AgregarBeneficiariosDto,
  AgregarMiembroEquipoDto,
  CambiarEstadoJornadaDto,
  CrearJornadaDto,
} from './dto/jornada.dto';
import { FiltrosJornadaDto } from './dto/filtros-jornada.dto';
import {
  ResumenJornadaDto,
  RespuestaJornadaDto,
  RespuestaPaginadaJornadasDto,
} from './dto/respuesta-jornada.dto';
import { JornadasService } from './jornadas.service';

@ApiTags('Jornadas')
@ApiBearerAuth('bearer')
@Controller('jornadas')
export class JornadasController {
  constructor(private readonly jornadasService: JornadasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva jornada' })
  @ApiResponse({ status: 201, type: RespuestaJornadaDto })
  crear(
    @Body() dto: CrearJornadaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.crear(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Listar jornadas con filtros y paginación' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaJornadasDto })
  listar(
    @Query() filtros: FiltrosJornadaDto,
  ): Promise<RespuestaPaginadaJornadasDto> {
    return this.jornadasService.listar(filtros);
  }

  @Get(':id/resumen')
  @ApiOperation({ summary: 'Obtener resumen de una jornada' })
  @ApiResponse({ status: 200, type: ResumenJornadaDto })
  obtenerResumen(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResumenJornadaDto> {
    return this.jornadasService.obtenerResumen(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una jornada por ID' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  obtenerUna(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.obtenerUna(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de una jornada' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarJornadaDto,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Cambiar el estado de una jornada' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoJornadaDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.cambiarEstado(id, dto, usuario);
  }

  @Post(':id/beneficiarios')
  @ApiOperation({ summary: 'Agregar beneficiarios a una jornada' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  agregarBeneficiarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AgregarBeneficiariosDto,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.agregarBeneficiarios(id, dto);
  }

  @Post(':id/equipo')
  @ApiOperation({ summary: 'Agregar un miembro al equipo de la jornada' })
  @ApiResponse({ status: 200, type: RespuestaJornadaDto })
  agregarMiembroEquipo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AgregarMiembroEquipoDto,
  ): Promise<RespuestaJornadaDto> {
    return this.jornadasService.agregarMiembroEquipo(id, dto);
  }
}
