import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { BeneficiariosService } from './beneficiarios.service';
import {
  ActualizarBeneficiarioDto,
  CrearBeneficiarioDto,
  FiltrosBeneficiarioDto,
} from './dto/beneficiario.dto';
import {
  RespuestaBeneficiarioDto,
  RespuestaPaginadaBeneficiariosDto,
  RespuestaUsoBeneficiarioDto,
} from './dto/respuesta-beneficiario.dto';
import { RespuestaCargaMasivaBeneficiariosDto } from '../proyectos/dto/carga-beneficiarios.dto';
import { parsearExcelBeneficiarios, generarPlantillaExcelBeneficiarios } from '../proyectos/utils/excel-beneficiarios';

@ApiTags('Beneficiarios')
@ApiBearerAuth('bearer')
@Controller('beneficiarios')
export class BeneficiariosController {
  constructor(private readonly beneficiariosService: BeneficiariosService) {}

  @Get()
  @RequierePermisos('contrapartes.ver')
  @ApiOperation({ summary: 'Listar beneficiarios' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaBeneficiariosDto })
  listar(
    @Query() filtros: FiltrosBeneficiarioDto,
  ): Promise<RespuestaPaginadaBeneficiariosDto> {
    return this.beneficiariosService.listar(filtros);
  }

  @Get('plantilla-excel')
  @RequierePermisos('contrapartes.editar')
  @ApiOperation({ summary: 'Plantilla Excel para cargar beneficiarios al catálogo' })
  async plantillaExcel(@Res() res: Response): Promise<void> {
    const buffer = await generarPlantillaExcelBeneficiarios();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-beneficiarios.xlsx"',
    );
    res.send(buffer);
  }

  @Post('previsualizar')
  @RequierePermisos('contrapartes.editar')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Lee el Excel de beneficiarios sin guardarlo' })
  async previsualizar(@UploadedFile() archivo: Express.Multer.File) {
    if (!archivo?.buffer) {
      throw new BadRequestException('Adjunta un archivo Excel (.xlsx)');
    }
    const filas = await parsearExcelBeneficiarios(archivo.buffer);
    return { filas };
  }

  @Post('importar')
  @RequierePermisos('contrapartes.editar')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        archivo: { type: 'string', format: 'binary' },
        veredaId: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Carga masiva al catálogo. Las personas nuevas quedan en la vereda indicada. Si el documento ya existe, no se duplica.',
  })
  @ApiResponse({ status: 201, type: RespuestaCargaMasivaBeneficiariosDto })
  importar(
    @UploadedFile() archivo: Express.Multer.File,
    @Body('veredaId') veredaId: string,
  ): Promise<RespuestaCargaMasivaBeneficiariosDto> {
    if (!archivo?.buffer) {
      throw new BadRequestException('Adjunta un archivo Excel (.xlsx)');
    }
    return this.beneficiariosService.importarExcel(archivo, veredaId);
  }

  @Get(':id')
  @RequierePermisos('contrapartes.ver')
  @ApiOperation({ summary: 'Obtener un beneficiario por ID' })
  @ApiResponse({ status: 200, type: RespuestaBeneficiarioDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaBeneficiarioDto> {
    return this.beneficiariosService.obtenerUno(id);
  }

  @Post()
  @RequierePermisos('contrapartes.crear')
  @ApiOperation({ summary: 'Crear un beneficiario' })
  @ApiResponse({ status: 201, type: RespuestaBeneficiarioDto })
  crear(@Body() dto: CrearBeneficiarioDto): Promise<RespuestaBeneficiarioDto> {
    return this.beneficiariosService.crear(dto);
  }

  @Patch(':id')
  @RequierePermisos('contrapartes.editar')
  @ApiOperation({ summary: 'Actualizar un beneficiario' })
  @ApiResponse({ status: 200, type: RespuestaBeneficiarioDto })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarBeneficiarioDto,
  ): Promise<RespuestaBeneficiarioDto> {
    return this.beneficiariosService.actualizar(id, dto);
  }

  @Get(':id/uso')
  @RequierePermisos('contrapartes.ver')
  @ApiOperation({
    summary: 'Dónde se usa un beneficiario (proyectos, jornadas, asociaciones, documentos)',
  })
  @ApiResponse({ status: 200, type: RespuestaUsoBeneficiarioDto })
  obtenerUso(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaUsoBeneficiarioDto> {
    return this.beneficiariosService.obtenerUso(id);
  }

  @Post(':id/desactivar')
  @RequierePermisos('contrapartes.editar')
  @ApiOperation({
    summary: 'Desactivar un beneficiario (reversible)',
    description:
      'Deja de aparecer en listados y selectores; se puede reactivar desde la pestaña Desactivados.',
  })
  @ApiResponse({ status: 201, type: RespuestaBeneficiarioDto })
  desactivar(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaBeneficiarioDto> {
    return this.beneficiariosService.desactivar(id);
  }

  @Post(':id/reactivar')
  @RequierePermisos('contrapartes.editar')
  @ApiOperation({ summary: 'Reactivar un beneficiario desactivado' })
  @ApiResponse({ status: 201, type: RespuestaBeneficiarioDto })
  reactivar(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaBeneficiarioDto> {
    return this.beneficiariosService.reactivar(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermisos('contrapartes.eliminar')
  @ApiOperation({
    summary: 'Eliminar un beneficiario (no reversible)',
    description:
      'Lo quita de las asociaciones y de toda la plataforma. El historial de proyectos y jornadas conserva la referencia. Su documento no se puede volver a registrar.',
  })
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.beneficiariosService.eliminar(id);
  }
}
