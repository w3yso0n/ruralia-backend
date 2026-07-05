import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FiltrosVeredaDto } from './dto/filtros-vereda.dto';
import { ResolverVeredaDto } from './dto/resolver-vereda.dto';
import {
  RespuestaPaginadaVeredasDto,
  RespuestaVeredaDto,
} from './dto/respuesta-vereda.dto';
import { TerritoriosService } from './territorios.service';

@ApiTags('Territorios')
@ApiBearerAuth('bearer')
@Controller('territorios')
export class TerritoriosController {
  constructor(private readonly territoriosService: TerritoriosService) {}

  @Get('veredas')
  @ApiOperation({ summary: 'Listar veredas para filtros y formularios' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaVeredasDto })
  listarVeredas(
    @Query() filtros: FiltrosVeredaDto,
  ): Promise<RespuestaPaginadaVeredasDto> {
    return this.territoriosService.listarVeredas(filtros);
  }

  @Post('veredas/resolver')
  @ApiOperation({
    summary:
      'Buscar o crear vereda a partir de datos de mapa (Google Places) o texto',
  })
  @ApiResponse({ status: 201, type: RespuestaVeredaDto })
  resolverVereda(@Body() dto: ResolverVeredaDto): Promise<RespuestaVeredaDto> {
    return this.territoriosService.resolverVereda(dto);
  }
}
