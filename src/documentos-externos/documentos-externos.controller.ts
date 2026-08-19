import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { RequierePermisos } from '../autenticacion/decorators/requiere-permisos.decorator';
import { UsuarioActual } from '../autenticacion/decorators/usuario-actual.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { DocumentosExternosService } from './documentos-externos.service';
import { FiltrosDocumentoExternoDto } from './dto/filtros-documento-externo.dto';
import { SubirDocumentoExternoDto } from './dto/subir-documento-externo.dto';

const TIPOS_PERMITIDOS = [
  /^image\//,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/,
  /^application\/vnd\.ms-excel$/,
  /^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$/,
];

function filtrarArchivo(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  const permitido = TIPOS_PERMITIDOS.some((patron) => patron.test(file.mimetype));

  if (!permitido) {
    callback(
      new Error(
        'Tipo de archivo no permitido. Use PDF, Word, Excel o imágenes',
      ),
      false,
    );
    return;
  }

  callback(null, true);
}

@ApiTags('Documentos externos')
@ApiBearerAuth('bearer')
@Controller('documentos-externos')
export class DocumentosExternosController {
  constructor(
    private readonly documentosExternosService: DocumentosExternosService,
  ) {}

  @Post()
  @RequierePermisos('documentos_externos.crear')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: {
        fileSize:
          Number(process.env.TAMANO_MAXIMO_ARCHIVO) || 50 * 1024 * 1024,
      },
      fileFilter: filtrarArchivo,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir un documento externo',
    description:
      'Carga un documento generado fuera de la plataforma (PDF, Word, Excel, escaneo, acta de terceros) y lo vincula al contexto operativo del proyecto.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo', 'titulo', 'tipo', 'proyectoId'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        tipo: { type: 'string' },
        proyectoId: { type: 'string', format: 'uuid' },
        actividadId: { type: 'string', format: 'uuid' },
        subactividadId: { type: 'string', format: 'uuid' },
        jornadaId: { type: 'string', format: 'uuid' },
        beneficiarioId: { type: 'string', format: 'uuid' },
        asociacionId: { type: 'string', format: 'uuid' },
        veredaId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Documento externo creado' })
  @ApiResponse({ status: 400, description: 'Archivo inválido o faltante' })
  subir(
    @UploadedFile() archivo: Express.Multer.File,
    @Body() body: SubirDocumentoExternoDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    if (!archivo) {
      throw new BadRequestException('El archivo es requerido');
    }

    return this.documentosExternosService.subir(archivo, body, usuario);
  }

  @Get()
  @RequierePermisos('documentos_externos.ver')
  @ApiOperation({ summary: 'Listar documentos externos con filtros' })
  listar(@Query() filtros: FiltrosDocumentoExternoDto) {
    return this.documentosExternosService.listar(filtros);
  }

  @Get(':id')
  @RequierePermisos('documentos_externos.ver')
  @ApiOperation({ summary: 'Obtener un documento externo' })
  obtenerUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentosExternosService.obtenerUno(id);
  }

  @Delete(':id')
  @RequierePermisos('documentos_externos.eliminar')
  @ApiOperation({ summary: 'Eliminar un documento externo' })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.documentosExternosService.eliminar(id, usuario);
  }
}
