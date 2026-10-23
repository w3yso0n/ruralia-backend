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
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarProyectoDto } from './dto/actualizar-proyecto.dto';
import { AsignarPersonalDto } from './dto/asignar-personal.dto';
import { AsignarTerritoriosDto } from './dto/asignar-territorios.dto';
import {
  AsignarAsociacionesProyectoDto,
  AsignarBeneficiariosProyectoDto,
} from './dto/asignar-vinculos.dto';
import {
  RespuestaCampoBeneficiarioDto,
  RespuestaCargaMasivaBeneficiariosDto,
  RespuestaHistorialBeneficiarioProyectoDto,
  ReemplazarBeneficiarioProyectoDto,
} from './dto/carga-beneficiarios.dto';
import { CrearProyectoDto } from './dto/crear-proyecto.dto';
import { FiltrosBeneficiariosProyectoDto } from './dto/filtros-beneficiarios-proyecto.dto';
import { FiltrosProyectoDto } from './dto/filtros-proyecto.dto';
import {
  EstadisticasProyectoDto,
  RespuestaPaginadaBeneficiariosProyectoDto,
  RespuestaPaginadaProyectosDto,
  RespuestaProyectoDto,
} from './dto/respuesta-proyecto.dto';
import {
  FiltrosEquipoResumenDto,
  MiembroEquipoResumenDto,
  ResumenProyectoDto,
} from './dto/resumen-proyecto.dto';
import { ProyectosService } from './proyectos.service';

@ApiTags('Proyectos')
@ApiBearerAuth('bearer')
@Controller('proyectos')
export class ProyectosController {
  constructor(
    private readonly proyectosService: ProyectosService,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

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
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPaginadaProyectosDto> {
    return this.proyectosService.listar(filtros, usuario);
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

  @Post('beneficiarios-excel/analizar')
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
      properties: {
        archivo: { type: 'string', format: 'binary' },
        proyectoId: {
          type: 'string',
          description: 'Opcional: reutiliza los datos adicionales que el proyecto ya tiene',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Lee las columnas de cualquier Excel y propone a qué campo va cada una',
  })
  analizarBeneficiariosExcel(
    @UploadedFile() archivo: Express.Multer.File,
    @Body('proyectoId') proyectoId?: string,
  ) {
    if (!archivo?.buffer) {
      throw new BadRequestException('Adjunta un archivo Excel (.xlsx)');
    }
    return this.proyectosService.analizarExcelBeneficiarios(archivo, proyectoId);
  }

  @Post('beneficiarios-excel/previsualizar')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Lee el Excel de beneficiarios sin guardarlo' })
  async previsualizarBeneficiariosExcel(
    @UploadedFile() archivo: Express.Multer.File,
    @Body('mapeo') mapeo?: string,
    @Body('proyectoId') proyectoId?: string,
  ) {
    if (!archivo?.buffer) {
      throw new BadRequestException('Adjunta un archivo Excel (.xlsx)');
    }
    const filas = await this.proyectosService.previsualizarExcelBeneficiarios(
      archivo,
      mapeo,
      proyectoId,
    );
    return { filas };
  }

  @Get(':id/estadisticas')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({ summary: 'Obtener estadísticas de un proyecto' })
  @ApiResponse({ status: 200, type: EstadisticasProyectoDto })
  async obtenerEstadisticas(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<EstadisticasProyectoDto> {
    await this.alcanceTerritorialService.assertConsultaCompletaProyecto(
      usuario,
      id,
    );
    return this.proyectosService.obtenerEstadisticas(id);
  }

  @Get(':id/resumen')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary: 'Agregados de la pestaña Resumen (sin listas de personas)',
  })
  @ApiResponse({ status: 200, type: ResumenProyectoDto })
  async obtenerResumen(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<ResumenProyectoDto> {
    await this.alcanceTerritorialService.assertConsultaCompletaProyecto(
      usuario,
      id,
    );
    return this.proyectosService.obtenerResumen(id);
  }

  @Get(':id/resumen/equipo')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary: 'Personas del equipo para el detalle del Resumen (por rol)',
  })
  @ApiResponse({ status: 200, type: [MiembroEquipoResumenDto] })
  async listarEquipoResumen(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filtros: FiltrosEquipoResumenDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<MiembroEquipoResumenDto[]> {
    await this.alcanceTerritorialService.assertConsultaCompletaProyecto(
      usuario,
      id,
    );
    return this.proyectosService.listarEquipoResumen(id, filtros);
  }

  @Get(':id')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({ summary: 'Obtener un proyecto por ID' })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.obtenerUno(id, usuario);
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
  @ApiOperation({ summary: 'Asignar municipios y veredas al proyecto' })
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

  @Get(':id/beneficiarios')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary:
      'Beneficiarios del proyecto, paginados. No forma parte del detalle del proyecto.',
  })
  @ApiResponse({ status: 200, type: RespuestaPaginadaBeneficiariosProyectoDto })
  listarBeneficiarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filtros: FiltrosBeneficiariosProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaPaginadaBeneficiariosProyectoDto> {
    return this.proyectosService.listarBeneficiariosDelProyecto(
      id,
      filtros,
      usuario,
    );
  }

  @Get(':id/beneficiarios/campos')
  @RequierePermisos('proyectos.ver')
  @ApiOperation({
    summary: 'Datos adicionales que maneja el proyecto (columnas extra de sus cargas)',
  })
  @ApiResponse({ status: 200, type: [RespuestaCampoBeneficiarioDto] })
  listarCamposBeneficiario(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaCampoBeneficiarioDto[]> {
    return this.proyectosService.listarCamposBeneficiario(id, usuario);
  }

  @Post(':id/beneficiarios/vincular')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @ApiOperation({
    summary:
      'Vincula beneficiarios sin quitar a los que ya están en el proyecto',
  })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  vincularBeneficiarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarBeneficiariosProyectoDto,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.vincularBeneficiarios(id, dto, usuario);
  }

  @Delete(':id/beneficiarios/:beneficiarioId')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @ApiOperation({
    summary: 'Quita a un beneficiario del cupo activo del proyecto',
  })
  @ApiResponse({ status: 200, type: RespuestaProyectoDto })
  desvincularBeneficiario(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('beneficiarioId', ParseUUIDPipe) beneficiarioId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaProyectoDto> {
    return this.proyectosService.desvincularBeneficiario(
      id,
      beneficiarioId,
      usuario,
    );
  }

  @Post(':id/beneficiarios')
  @RequierePermisos('proyectos.gestionar_vinculos')
  @ApiOperation({
    summary:
      'Asignar beneficiarios al proyecto (varios, no excluye asociaciones)',
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
      properties: {
        archivo: { type: 'string', format: 'binary' },
        veredaId: { type: 'string' },
        mapeo: {
          type: 'string',
          description: 'JSON con la asignación de columnas. Vacío: automática.',
        },
      },
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
    @Body('veredaId') veredaId: string,
    @UsuarioActual() usuario: Usuario,
    @Body('mapeo') mapeo?: string,
  ): Promise<RespuestaCargaMasivaBeneficiariosDto> {
    if (!archivo?.buffer) {
      throw new BadRequestException('Adjunta un archivo Excel (.xlsx)');
    }
    return this.proyectosService.importarBeneficiariosExcel(
      id,
      archivo,
      usuario,
      veredaId,
      mapeo,
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
  async historialBeneficiario(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('beneficiarioId', ParseUUIDPipe) beneficiarioId: string,
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaHistorialBeneficiarioProyectoDto> {
    await this.alcanceTerritorialService.assertConsultaCompletaProyecto(
      usuario,
      id,
    );
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
