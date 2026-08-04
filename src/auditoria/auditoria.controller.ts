import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { AuditoriaService } from './auditoria.service';
import {
  FiltrosAuditoriaDto,
  RespuestaPaginadaAuditoriaDto,
} from './dto/auditoria.dto';

@ApiTags('Auditoría')
@ApiBearerAuth('bearer')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @RequierePermisos('auditoria.ver')
  @ApiOperation({ summary: 'Listar bitácora de auditoría (solo lectura)' })
  listar(
    @Query() filtros: FiltrosAuditoriaDto,
  ): Promise<RespuestaPaginadaAuditoriaDto> {
    return this.auditoriaService.listar(filtros);
  }
}
