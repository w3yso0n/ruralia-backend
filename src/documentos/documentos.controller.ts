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
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';

@ApiTags('Documentos')
@ApiBearerAuth('bearer')
@Controller('documentos')
export class DocumentosController {
  constructor(
    private readonly documentosService: DocumentosService,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

  @Get('jornada/:jornadaId')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Listar documentos de una jornada' })
  async listarPorJornada(
    @Param('jornadaId', ParseUUIDPipe) jornadaId: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    await this.alcanceTerritorialService.assertTecnicoEnJornada(
      usuario,
      jornadaId,
    );
    return this.documentosService.listarPorJornada(jornadaId);
  }

  @Get(':id')
  @RequierePermisos('jornadas.ver')
  @ApiOperation({ summary: 'Obtener documento con versiones' })
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    await this.alcanceTerritorialService.assertTecnicoEnRegistroDeJornada(
      usuario,
      'documents',
      id,
    );
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
    @UsuarioActual() usuario: Usuario,
  ): Promise<StreamableFile> {
    await this.alcanceTerritorialService.assertTecnicoEnRegistroDeJornada(
      usuario,
      'documents',
      id,
    );
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
  async comparar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('a', ParseUUIDPipe) a: string,
    @Query('b', ParseUUIDPipe) b: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    await this.alcanceTerritorialService.assertTecnicoEnRegistroDeJornada(
      usuario,
      'documents',
      id,
    );
    return this.documentosService.compararVersiones(id, a, b);
  }
}
