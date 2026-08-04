import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { DocumentosService } from './documentos.service';

@ApiTags('Documentos')
@ApiBearerAuth('bearer')
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Get('jornada/:jornadaId')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Listar documentos de una jornada' })
  listarPorJornada(@Param('jornadaId', ParseUUIDPipe) jornadaId: string) {
    return this.documentosService.listarPorJornada(jornadaId);
  }

  @Get(':id')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Obtener documento con versiones' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentosService.obtenerConVersiones(id);
  }

  @Get(':id/versiones/comparar')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Comparar dos versiones de un documento' })
  comparar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('a', ParseUUIDPipe) a: string,
    @Query('b', ParseUUIDPipe) b: string,
  ) {
    return this.documentosService.compararVersiones(id, a, b);
  }
}
