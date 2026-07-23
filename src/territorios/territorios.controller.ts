import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { FiltrosVeredaDto } from './dto/filtros-vereda.dto';
import { FiltrosBusquedaTerritorioDto } from './dto/filtros-busqueda-territorio.dto';
import { RespuestaBusquedaTerritorialDto } from './dto/respuesta-busqueda-territorio.dto';
import { RespuestaNodoTerritorialDto } from './dto/respuesta-nodo-territorial.dto';
import { ResolverVeredaDto } from './dto/resolver-vereda.dto';
import {
  RespuestaPaginadaVeredasDto,
  RespuestaVeredaDto,
} from './dto/respuesta-vereda.dto';
import {
  ActualizarNodoTerritorialDto,
  CrearDepartamentoDto,
  CrearMunicipioDto,
  CrearRegionDto,
  CrearVeredaAdminDto,
} from './dto/territorio-crud.dto';
import { TerritoriosService } from './territorios.service';

@ApiTags('Territorios')
@ApiBearerAuth('bearer')
@Controller('territorios')
export class TerritoriosController {
  constructor(private readonly territoriosService: TerritoriosService) {}

  @Get('buscar')
  @RequierePermisos('territorios.ver')
  @ApiOperation({
    summary:
      'Buscar territorios por nombre o código en todos los niveles de la jerarquía',
  })
  @ApiResponse({ status: 200, type: [RespuestaBusquedaTerritorialDto] })
  buscarTerritorios(
    @Query() filtros: FiltrosBusquedaTerritorioDto,
  ): Promise<RespuestaBusquedaTerritorialDto[]> {
    return this.territoriosService.buscarTerritorios(filtros);
  }

  @Get('regiones')
  @RequierePermisos('territorios.ver')
  @ApiOperation({ summary: 'Listar regiones naturales' })
  @ApiQuery({ name: 'incluirInactivos', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [RespuestaNodoTerritorialDto] })
  listarRegiones(
    @Query('incluirInactivos', new ParseBoolPipe({ optional: true }))
    incluirInactivos?: boolean,
  ): Promise<RespuestaNodoTerritorialDto[]> {
    return this.territoriosService.listarRegiones(!!incluirInactivos);
  }

  @Post('regiones')
  @RequierePermisos('territorios.crear')
  @ApiOperation({ summary: 'Crear región' })
  @ApiResponse({ status: 201, type: RespuestaNodoTerritorialDto })
  crearRegion(@Body() dto: CrearRegionDto): Promise<RespuestaNodoTerritorialDto> {
    return this.territoriosService.crearRegion(dto);
  }

  @Patch('regiones/:id')
  @RequierePermisos('territorios.editar')
  @ApiOperation({ summary: 'Actualizar región' })
  @ApiResponse({ status: 200, type: RespuestaNodoTerritorialDto })
  actualizarRegion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarNodoTerritorialDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    return this.territoriosService.actualizarRegion(id, dto);
  }

  @Delete('regiones/:id')
  @RequierePermisos('territorios.eliminar')
  @ApiOperation({ summary: 'Desactivar región' })
  desactivarRegion(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.territoriosService.desactivarRegion(id);
  }

  @Get('departamentos')
  @RequierePermisos('territorios.ver')
  @ApiOperation({ summary: 'Listar departamentos (opcionalmente por región)' })
  @ApiQuery({ name: 'regionId', required: false })
  @ApiQuery({ name: 'incluirInactivos', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [RespuestaNodoTerritorialDto] })
  listarDepartamentos(
    @Query('regionId') regionId?: string,
    @Query('incluirInactivos', new ParseBoolPipe({ optional: true }))
    incluirInactivos?: boolean,
  ): Promise<RespuestaNodoTerritorialDto[]> {
    return this.territoriosService.listarDepartamentos(
      regionId || undefined,
      !!incluirInactivos,
    );
  }

  @Post('departamentos')
  @RequierePermisos('territorios.crear')
  @ApiOperation({ summary: 'Crear departamento' })
  @ApiResponse({ status: 201, type: RespuestaNodoTerritorialDto })
  crearDepartamento(
    @Body() dto: CrearDepartamentoDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    return this.territoriosService.crearDepartamento(dto);
  }

  @Patch('departamentos/:id')
  @RequierePermisos('territorios.editar')
  @ApiOperation({ summary: 'Actualizar departamento' })
  @ApiResponse({ status: 200, type: RespuestaNodoTerritorialDto })
  actualizarDepartamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarNodoTerritorialDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    return this.territoriosService.actualizarDepartamento(id, dto);
  }

  @Delete('departamentos/:id')
  @RequierePermisos('territorios.eliminar')
  @ApiOperation({ summary: 'Desactivar departamento' })
  desactivarDepartamento(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.territoriosService.desactivarDepartamento(id);
  }

  @Get('municipios')
  @RequierePermisos('territorios.ver')
  @ApiOperation({ summary: 'Listar municipios de un departamento' })
  @ApiQuery({ name: 'departamentoId', required: true })
  @ApiQuery({ name: 'incluirInactivos', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [RespuestaNodoTerritorialDto] })
  listarMunicipios(
    @Query('departamentoId', ParseUUIDPipe) departamentoId: string,
    @Query('incluirInactivos', new ParseBoolPipe({ optional: true }))
    incluirInactivos?: boolean,
  ): Promise<RespuestaNodoTerritorialDto[]> {
    return this.territoriosService.listarMunicipios(
      departamentoId,
      !!incluirInactivos,
    );
  }

  @Post('municipios')
  @RequierePermisos('territorios.crear')
  @ApiOperation({ summary: 'Crear municipio' })
  @ApiResponse({ status: 201, type: RespuestaNodoTerritorialDto })
  crearMunicipio(
    @Body() dto: CrearMunicipioDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    return this.territoriosService.crearMunicipio(dto);
  }

  @Patch('municipios/:id')
  @RequierePermisos('territorios.editar')
  @ApiOperation({ summary: 'Actualizar municipio' })
  @ApiResponse({ status: 200, type: RespuestaNodoTerritorialDto })
  actualizarMunicipio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarNodoTerritorialDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    return this.territoriosService.actualizarMunicipio(id, dto);
  }

  @Delete('municipios/:id')
  @RequierePermisos('territorios.eliminar')
  @ApiOperation({ summary: 'Desactivar municipio' })
  desactivarMunicipio(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.territoriosService.desactivarMunicipio(id);
  }

  @Get('municipios/:municipioId/veredas')
  @RequierePermisos('territorios.ver')
  @ApiOperation({ summary: 'Listar veredas de un municipio' })
  @ApiQuery({ name: 'incluirInactivos', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [RespuestaNodoTerritorialDto] })
  listarVeredasPorMunicipio(
    @Param('municipioId', ParseUUIDPipe) municipioId: string,
    @Query('incluirInactivos', new ParseBoolPipe({ optional: true }))
    incluirInactivos?: boolean,
  ): Promise<RespuestaNodoTerritorialDto[]> {
    return this.territoriosService.listarVeredasPorMunicipio(
      municipioId,
      !!incluirInactivos,
    );
  }

  @Get('veredas')
  @RequierePermisos('territorios.ver')
  @ApiOperation({ summary: 'Listar veredas para filtros y formularios' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaVeredasDto })
  listarVeredas(
    @Query() filtros: FiltrosVeredaDto,
  ): Promise<RespuestaPaginadaVeredasDto> {
    return this.territoriosService.listarVeredas(filtros);
  }

  @Post('veredas/resolver')
  @RequierePermisos('territorios.ver')
  @ApiOperation({
    summary:
      'Buscar o crear vereda a partir de datos de mapa (Google Places) o texto',
  })
  @ApiResponse({ status: 201, type: RespuestaVeredaDto })
  resolverVereda(@Body() dto: ResolverVeredaDto): Promise<RespuestaVeredaDto> {
    return this.territoriosService.resolverVereda(dto);
  }

  @Post('veredas')
  @RequierePermisos('territorios.crear')
  @ApiOperation({ summary: 'Crear vereda (administración)' })
  @ApiResponse({ status: 201, type: RespuestaNodoTerritorialDto })
  crearVereda(
    @Body() dto: CrearVeredaAdminDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    return this.territoriosService.crearVeredaAdmin(dto);
  }

  @Patch('veredas/:id')
  @RequierePermisos('territorios.editar')
  @ApiOperation({ summary: 'Actualizar vereda' })
  @ApiResponse({ status: 200, type: RespuestaNodoTerritorialDto })
  actualizarVereda(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarNodoTerritorialDto,
  ): Promise<RespuestaNodoTerritorialDto> {
    return this.territoriosService.actualizarVeredaAdmin(id, dto);
  }

  @Delete('veredas/:id')
  @RequierePermisos('territorios.eliminar')
  @ApiOperation({ summary: 'Desactivar vereda' })
  desactivarVereda(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.territoriosService.desactivarVereda(id);
  }
}
