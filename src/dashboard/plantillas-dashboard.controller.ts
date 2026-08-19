import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarPlantillaDashboardDto,
  AsignarPlantillaRolDto,
  CompatibilidadRolWidgetDto,
  CrearPlantillaDashboardDto,
  PlantillaDashboardDto,
} from './dto/plantilla-dashboard.dto';
import { PlantillasDashboardService } from './plantillas-dashboard.service';

@ApiTags('Dashboard — Plantillas')
@ApiBearerAuth('bearer')
@Controller('dashboard/plantillas')
@RequierePermisos('configuracion.gestionar_plantillas')
export class PlantillasDashboardController {
  constructor(private readonly plantillasService: PlantillasDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Galería de plantillas de dashboard' })
  @ApiResponse({ status: 200, type: [PlantillaDashboardDto] })
  listar(): Promise<PlantillaDashboardDto[]> {
    return this.plantillasService.listar();
  }

  @Get('compatibilidad-roles')
  @ApiOperation({
    summary:
      'Por cada widget del catálogo, qué roles cumplen su permiso requerido ahora mismo',
  })
  @ApiResponse({ status: 200, type: [CompatibilidadRolWidgetDto] })
  obtenerCompatibilidadRoles(): Promise<CompatibilidadRolWidgetDto[]> {
    return this.plantillasService.obtenerCompatibilidadRoles();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una plantilla' })
  @ApiResponse({ status: 200, type: PlantillaDashboardDto })
  obtenerUna(@Param('id') id: string): Promise<PlantillaDashboardDto> {
    return this.plantillasService.obtenerUna(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una plantilla de dashboard' })
  @ApiResponse({ status: 201, type: PlantillaDashboardDto })
  crear(
    @UsuarioActual() usuario: Usuario,
    @Body() dto: CrearPlantillaDashboardDto,
  ): Promise<PlantillaDashboardDto> {
    return this.plantillasService.crear(usuario, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar nombre, descripción o widgets de una plantilla',
  })
  @ApiResponse({ status: 200, type: PlantillaDashboardDto })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarPlantillaDashboardDto,
  ): Promise<PlantillaDashboardDto> {
    return this.plantillasService.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una plantilla' })
  eliminar(@Param('id') id: string): Promise<void> {
    return this.plantillasService.eliminar(id);
  }

  @Post(':id/asignar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Asignar la plantilla a un rol' })
  asignar(
    @Param('id') id: string,
    @Body() dto: AsignarPlantillaRolDto,
  ): Promise<void> {
    return this.plantillasService.asignarARol(id, dto.rolId);
  }

  @Delete('asignaciones/:rolId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar la plantilla asignada a un rol' })
  quitarAsignacion(@Param('rolId') rolId: string): Promise<void> {
    return this.plantillasService.quitarAsignacion(rolId);
  }
}
