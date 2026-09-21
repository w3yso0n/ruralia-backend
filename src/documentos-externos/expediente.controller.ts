import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { DescargarExpedienteDto } from './dto/descargar-expediente.dto';
import { ExpedienteDescargaService } from './expediente-descarga.service';
import { ExpedienteService } from './expediente.service';

@ApiTags('Expediente')
@ApiBearerAuth('bearer')
@Controller('proyectos')
export class ExpedienteController {
  constructor(
    private readonly expedienteService: ExpedienteService,
    private readonly descargaService: ExpedienteDescargaService,
  ) {}

  @Get(':id/expediente')
  @RequierePermisos('documentos_externos.ver')
  @ApiOperation({
    summary: 'Expediente digital del proyecto',
    description:
      'Consolida los documentos generados por la plataforma y los documentos externos vinculados al proyecto (RF-12, RF-24).',
  })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.expedienteService.obtenerExpediente(id);
  }

  @Post(':id/expediente/descarga')
  @RequierePermisos('documentos_externos.ver')
  @ApiOperation({
    summary: 'Descargar expediente filtrado en ZIP',
    description:
      'Arma un ZIP con el PDF vigente, los adjuntos del formulario y las evidencias de cada jornada, en carpetas de actividad, subactividad, proceso, meta y jornada.',
  })
  descargar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DescargarExpedienteDto,
    @Res() res: Response,
  ) {
    return this.descargaService.escribirZip(id, dto, res);
  }
}
