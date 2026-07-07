import {
  Body,
  Controller,
  Get,
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
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RolEnum } from '../autenticacion/enums/rol.enum';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarPlantillaFormularioDto,
  AsignarSubactividadesDto,
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
  @Roles(RolEnum.ADMINISTRADOR)
  @ApiOperation({ summary: 'Crear una plantilla de formulario' })
  @ApiResponse({ status: 201, type: RespuestaPlantillaFormularioDto })
  crearPlantilla(
    @Body() dto: CrearPlantillaFormularioDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.crear(dto);
  }

  @Get('plantillas')
  @ApiOperation({ summary: 'Listar todas las plantillas de formulario' })
  @ApiResponse({ status: 200, type: [RespuestaPlantillaFormularioDto] })
  listarPlantillas(): Promise<RespuestaPlantillaFormularioDto[]> {
    return this.plantillasService.listarTodas();
  }

  @Get('plantillas/subactividad/:subactividadId')
  @ApiOperation({ summary: 'Listar plantillas por subactividad' })
  @ApiResponse({ status: 200, type: [RespuestaPlantillaFormularioDto] })
  listarPlantillasPorSubactividad(
    @Param('subactividadId', ParseUUIDPipe) subactividadId: string,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    return this.plantillasService.listarPorSubactividad(subactividadId);
  }

  @Get('plantillas/:id')
  @ApiOperation({ summary: 'Obtener una plantilla de formulario por ID' })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  obtenerPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.obtenerPorId(id);
  }

  @Patch('plantillas/:id')
  @Roles(RolEnum.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar una plantilla de formulario' })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  actualizarPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPlantillaFormularioDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.actualizar(id, dto);
  }

  @Post('plantillas/:id/publicar')
  @Roles(RolEnum.ADMINISTRADOR)
  @ApiOperation({ summary: 'Publicar una plantilla de formulario' })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  publicarPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.publicar(id);
  }

  @Post('plantillas/:id/clonar')
  @Roles(RolEnum.ADMINISTRADOR)
  @ApiOperation({ summary: 'Clonar una plantilla (sin subactividades asignadas)' })
  @ApiResponse({ status: 201, type: RespuestaPlantillaFormularioDto })
  clonarPlantilla(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.clonar(id);
  }

  @Patch('plantillas/:id/subactividades')
  @Roles(RolEnum.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Asignar subactividades a una plantilla (reemplaza el conjunto)',
  })
  @ApiResponse({ status: 200, type: RespuestaPlantillaFormularioDto })
  asignarSubactividades(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarSubactividadesDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    return this.plantillasService.asignarSubactividades(
      id,
      dto.subactividadIds,
    );
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
