import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { memoryStorage } from 'multer';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import {
  ActualizarVeredaPdetDto,
  CatalogoVeredasPdetDto,
  CrearVeredaPdetDto,
  FiltrosVeredaPdetDto,
  leerMapeoPdet,
  type MapeoVeredasPdet,
} from './dto/vereda-pdet.dto';
import { VeredasPdetService } from './veredas-pdet.service';

const SUBIDA = FileInterceptor('archivo', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function exigirArchivo(archivo?: Express.Multer.File): Express.Multer.File {
  if (!archivo?.buffer) {
    throw new BadRequestException('Adjunta un archivo Excel (.xlsx) o CSV');
  }
  return archivo;
}

function mapeoDesde(texto?: string): MapeoVeredasPdet {
  try {
    return leerMapeoPdet(texto);
  } catch {
    throw new BadRequestException('El mapeo de columnas no es válido');
  }
}

@ApiTags('Territorios - Veredas PDET')
@ApiBearerAuth('bearer')
@Controller('territorios/veredas-pdet')
export class VeredasPdetController {
  constructor(private readonly veredasPdetService: VeredasPdetService) {}

  @Get()
  @RequierePermisos('territorios.ver')
  @ApiOperation({ summary: 'Listar veredas PDET con filtros' })
  listar(@Query() filtros: FiltrosVeredaPdetDto) {
    return this.veredasPdetService.listar(filtros);
  }

  @Get('catalogo')
  @RequierePermisos('formularios.ver')
  @ApiOperation({
    summary:
      'Catálogo compacto departamento > municipio > vereda PDET para la app (se guarda para trabajar sin conexión)',
  })
  catalogo(@Query() filtros: CatalogoVeredasPdetDto) {
    return this.veredasPdetService.catalogo(filtros.proyectoId);
  }

  @Post()
  @RequierePermisos('territorios.crear')
  @ApiOperation({ summary: 'Crear una vereda PDET' })
  crear(@Body() dto: CrearVeredaPdetDto) {
    return this.veredasPdetService.crear(dto);
  }

  @Patch(':id')
  @RequierePermisos('territorios.editar')
  @ApiOperation({ summary: 'Editar o desactivar una vereda PDET' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarVeredaPdetDto,
  ) {
    return this.veredasPdetService.actualizar(id, dto);
  }

  @Post('importar/analizar')
  @RequierePermisos('territorios.crear')
  @UseInterceptors(SUBIDA)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Lee las columnas del archivo PDET y propone el mapeo',
  })
  analizar(@UploadedFile() archivo: Express.Multer.File) {
    const a = exigirArchivo(archivo);
    return this.veredasPdetService.analizar(a.buffer, a.originalname);
  }

  @Post('importar/previsualizar')
  @RequierePermisos('territorios.crear')
  @UseInterceptors(SUBIDA)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Muestra qué se crearía o actualizaría, sin guardar',
  })
  previsualizar(
    @UploadedFile() archivo: Express.Multer.File,
    @Body('mapeo') mapeo?: string,
  ) {
    const a = exigirArchivo(archivo);
    return this.veredasPdetService.previsualizar(
      a.buffer,
      mapeoDesde(mapeo),
      a.originalname,
    );
  }

  @Post('importar')
  @RequierePermisos('territorios.crear')
  @UseInterceptors(SUBIDA)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Importa el archivo: crea las veredas nuevas y actualiza las existentes (por municipio y código). Las filas con error se omiten.',
  })
  importar(
    @UploadedFile() archivo: Express.Multer.File,
    @Body('mapeo') mapeo?: string,
  ) {
    const a = exigirArchivo(archivo);
    return this.veredasPdetService.importar(
      a.buffer,
      mapeoDesde(mapeo),
      a.originalname,
    );
  }
}
