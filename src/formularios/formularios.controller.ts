import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
  ClonarPlantillaDto,
  CrearPlantillaFormularioDto,
  EnviarFormularioDto,
} from './dto/formulario.dto';
import {
  RespuestaDetalleRespuestaDto,
  RespuestaEnvioFormularioDto,
  RespuestaPlantillaFormularioDto,
} from './dto/respuesta-formulario.dto';
import { EnviosFormularioService } from './envios-formulario.service';
import { PlantillasFormularioService } from './plantillas-formulario.service';

@ApiTags('Formularios')
@ApiBearerAuth('bearer')
@Controller('formularios')
export class FormulariosController {
  constructor(
    private readonly plantillasService: PlantillasFormularioService,
    private readonly enviosService: EnviosFormularioService,
  ) {}

  @Post('plantillas')
  @ApiOperation({ summary: 'Crear una plantilla de formulario' })
  @ApiResponse({ status: 201, type: RespuestaPlantillaFormularioDto })
  crearPlantilla(
    @Body() dto: CrearPlantillaFormularioDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.crear(dto);
  }

  @Get('plantillas/subactividad/:subactividadId')
  @ApiOperation({ summary: 'Listar plantillas por subactividad' })
  @ApiResponse({ status: 200, type: [RespuestaPlantillaFormularioDto] })
  listarPlantillasPorSubactividad(
    @Param('subactividadId', ParseUUIDPipe) subactividadId: string,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    return this.plantillasService.listarPorSubactividad(subactividadId);
  }

  @Post('plantillas/:id/publicar')
  @ApiOperation({ summary: 'Publicar una plantilla de formulario' })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  publicarPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.publicar(id);
  }

  @Post('plantillas/:id/clonar')
  @ApiOperation({ summary: 'Clonar una plantilla en otra subactividad' })
  @ApiResponse({ status: 201, type: RespuestaPlantillaFormularioDto })
  clonarPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClonarPlantillaDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.clonar(id, dto.nuevaSubactividadId);
  }

  @Post('envios')
  @ApiOperation({ summary: 'Enviar un formulario completado' })
  @ApiResponse({ status: 201, type: RespuestaEnvioFormularioDto })
  enviarFormulario(
    @Body() dto: EnviarFormularioDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaEnvioFormularioDto> {
    return this.enviosService.enviar(dto, usuario);
  }

  @Get('envios/jornada/:jornadaId')
  @ApiOperation({ summary: 'Listar envíos de formulario por jornada' })
  @ApiResponse({ status: 200, type: [RespuestaEnvioFormularioDto] })
  listarEnviosPorJornada(
    @Param('jornadaId', ParseUUIDPipe) jornadaId: string,
  ): Promise<RespuestaEnvioFormularioDto[]> {
    return this.enviosService.listarPorJornada(jornadaId);
  }

  @Get('envios/:id/respuestas')
  @ApiOperation({ summary: 'Obtener respuestas de un envío de formulario' })
  @ApiResponse({ status: 200, type: [RespuestaDetalleRespuestaDto] })
  obtenerRespuestas(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaDetalleRespuestaDto[]> {
    return this.enviosService.obtenerRespuestas(id);
  }
}
