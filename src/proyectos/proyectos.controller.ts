import {
  BadRequestException,
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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
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
import {
  RespuestaCargaMasivaBeneficiariosDto,
  RespuestaHistorialBeneficiarioProyectoDto,
  ReemplazarBeneficiarioProyectoDto,
} from './dto/carga-beneficiarios.dto';
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

  @Get('plantilla-beneficiarios-excel')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @ApiOperation({
    summary: 'Plantilla Excel de carga masiva (nombre + identificador único)',
  })
  async plantillaBeneficiariosGlobal(@Res() res: Response): Promise<void> {
    const buffer = await this.proyectosService.generarPlantillaBeneficiarios();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-beneficiarios.xlsx"',
    );
    res.send(buffer);
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
  @ApiOperation({
    summary: 'Asignar beneficiarios al proyecto (varios, no excluye asociaciones)',
  })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  asignarBeneficiarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarBeneficiariosProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.asignarBeneficiarios(id, dto, usuario);
  }

  @Get(':id/beneficiarios/plantilla-excel')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @ApiOperation({ summary: 'Descargar plantilla Excel para carga masiva' })
  async plantillaBeneficiarios(@Res() res: Response): Promise<void> {
    const buffer = await this.proyectosService.generarPlantillaBeneficiarios();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-beneficiarios.xlsx"',
    );
    res.send(buffer);
  }

  @Post(':id/beneficiarios/importar')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Carga masiva de beneficiarios desde Excel. Si el documento ya existe, solo se asigna al proyecto.',
  })
  @ApiResponse({ status: 201, type: RespuestaCargaMasivaBeneficiariosDto })
  importarBeneficiarios(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: Express.Multer.File,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaCargaMasivaBeneficiariosDto> {
    if (!archivo?.buffer) {
      throw new BadRequestException('Adjunta un archivo Excel (.xlsx)');
    }
    return this.proyectosService.importarBeneficiariosExcel(
      id,
      archivo,
      usuario,
    );
  }

  @Post(':id/beneficiarios/:beneficiarioId/reemplazar')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @ApiOperation({
    summary:
      'Reemplaza un beneficiario del proyecto. El historial del cupo (jornadas) se conserva y queda marcado como reemplazo.',
  })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  reemplazarBeneficiario(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('beneficiarioId', ParseUUIDPipe) beneficiarioId: string,
    @Body() dto: ReemplazarBeneficiarioProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.reemplazarBeneficiario(
      id,
      beneficiarioId,
      dto,
      usuario,
    );
  }

  @Get(':id/beneficiarios/:beneficiarioId/historial')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Historial del cupo: jornadas propias y las heredadas de quien fue reemplazado',
  })
  @ApiResponse({ status: 200, type: RespuestaHistorialBeneficiarioProyectoDto })
  historialBeneficiario(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('beneficiarioId', ParseUUIDPipe) beneficiarioId: string,
  ): Promise<RespuestaHistorialBeneficiarioProyectoDto> {
    return this.proyectosService.historialBeneficiarioProyecto(
      id,
      beneficiarioId,
    );
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
