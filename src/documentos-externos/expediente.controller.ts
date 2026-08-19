import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { ExpedienteService } from './expediente.service';

@ApiTags('Expediente')
@ApiBearerAuth('bearer')
@Controller('proyectos')
export class ExpedienteController {
  constructor(private readonly expedienteService: ExpedienteService) {}

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
}
