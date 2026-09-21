import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
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

  @Get(':id/archivo')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({
    summary: 'Ver o descargar el PDF vigente de un documento generado',
  })
  @ApiProduces('application/pdf')
  async archivo(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('versionId', new ParseUUIDPipe({ optional: true }))
    versionId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, nombre } = await this.documentosService.leerPdfVigente(
      id,
      versionId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombre}"`,
    });
    return new StreamableFile(buffer);
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
