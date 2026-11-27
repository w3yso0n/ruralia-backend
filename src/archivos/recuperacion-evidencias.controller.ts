import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { memoryStorage } from 'multer';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { RecuperacionEvidenciasService } from './recuperacion-evidencias.service';

class ReporteRecuperacionDto {
  @IsInt()
  @Min(0)
  pendientes: number;

  @IsInt()
  @Min(0)
  coincidencias: number;

  @IsInt()
  @Min(0)
  archivosEnCache: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  subidas?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  errores?: number;
}

@ApiTags('Archivos')
@ApiBearerAuth('bearer')
@Controller('archivos/recuperacion')
export class RecuperacionEvidenciasController {
  constructor(
    private readonly recuperacionService: RecuperacionEvidenciasService,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

  @Get('pendientes')
  @RequierePermisos('archivos.subir')
  @ApiOperation({
    summary: 'Evidencias del usuario cuyo archivo ya no existe en el servidor',
  })
  listarPendientes(@UsuarioActual() usuario: Usuario) {
    return this.recuperacionService.listarPendientes(usuario.id);
  }

  @Post('reporte')
  @HttpCode(204)
  @RequierePermisos('archivos.subir')
  @ApiOperation({
    summary: 'Resultado de la búsqueda en la caché del dispositivo',
  })
  reportar(
    @UsuarioActual() usuario: Usuario,
    @Body() body: ReporteRecuperacionDto,
  ): void {
    this.recuperacionService.registrarReporte(usuario.id, body);
  }

  @Post('evidencia/:id')
  @RequierePermisos('archivos.subir')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: {
        fileSize: Number(process.env.TAMANO_MAXIMO_ARCHIVO) || 50 * 1024 * 1024,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Restaurar el archivo perdido de una evidencia existente',
  })
  async recuperar(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() archivo: Express.Multer.File,
    @UsuarioActual() usuario: Usuario,
  ) {
    if (!archivo) {
      throw new BadRequestException('El archivo es requerido');
    }
    await this.alcanceTerritorialService.assertTecnicoEnRegistroDeJornada(
      usuario,
      'evidencias',
      id,
    );
    return this.recuperacionService.recuperar(archivo, id);
  }
}
