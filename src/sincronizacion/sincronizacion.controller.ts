import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { ThrottlerPorUsuarioGuard } from '../common/guards/throttler-por-usuario.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { SubirSincronizacionDto } from './dto/subir-sincronizacion.dto';
import { ResultadoSincronizacionDto } from './dto/resultado-sincronizacion.dto';
import { SincronizacionService } from './sincronizacion.service';

@ApiTags('Sincronización')
@ApiBearerAuth('bearer')
@Controller('sincronizacion')
export class SincronizacionController {
  constructor(private readonly sincronizacionService: SincronizacionService) {}

  @Post('subir')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerPorUsuarioGuard)
  @ApiOperation({ summary: 'Subir datos offline para sincronización' })
  @ApiResponse({ status: 200, type: ResultadoSincronizacionDto })
  @ApiResponse({ status: 429, description: 'Límite de solicitudes excedido' })
  subir(
    @Body() dto: SubirSincronizacionDto,
    @UsuarioActual() _usuario: Usuario,
  ): Promise<ResultadoSincronizacionDto> {
    return this.sincronizacionService.subir(dto);
  }
}
