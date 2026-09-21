import {
  BadRequestException,
  Body,
  Controller,
  Post,
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
import { ArchivosService } from './archivos.service';
import { RespuestaSubirEvidenciaDto } from './dto/respuesta-subir-evidencia.dto';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TipoEvidencia } from '../evidencias/enums/tipo-evidencia.enum';
import { SubirEvidenciaDto } from './dto/subir-evidencia.dto';

class SubirEvidenciaJornadaDto {
  @IsUUID('4')
  jornadaId: string;

  @IsOptional()
  @IsEnum(TipoEvidencia)
  tipo?: TipoEvidencia;
}

const TIPOS_PERMITIDOS = [
  /^image\//,
  /^application\/pdf$/,
  /^video\/mp4$/,
  /^text\/plain$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\./,
  /^application\/vnd\.ms-excel$/,
  /^application\/vnd\.oasis\.opendocument\./,
  /^application\/octet-stream$/,
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
        'Tipo de archivo no permitido. Use image/*, application/pdf o video/mp4',
      ),
      false,
    );
    return;
  }

  callback(null, true);
}

@ApiTags('Archivos')
@ApiBearerAuth('bearer')
@Controller('archivos')
export class ArchivosController {
  constructor(private readonly archivosService: ArchivosService) {}

  @Post('evidencia')
  @RequierePermisos('archivos.subir')
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
    summary: 'Subir archivo de evidencia',
    description:
      'Recibe un archivo multimedia (imagen, PDF o video) y lo encola para procesamiento asíncrono. Actualiza el estado de la evidencia en la tabla `evidencias`.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo', 'evidenciaId', 'jornadaId'],
      properties: {
        archivo: { type: 'string', format: 'binary', description: 'Archivo de evidencia' },
        evidenciaId: { type: 'string', format: 'uuid', description: 'ID de la evidencia' },
        jornadaId: { type: 'string', format: 'uuid', description: 'ID de la jornada' },
      },
    },
  })
  @ApiResponse({ status: 201, type: RespuestaSubirEvidenciaDto })
  @ApiResponse({ status: 400, description: 'Archivo inválido o faltante' })
  @ApiResponse({ status: 404, description: 'Evidencia no encontrada' })
  subirEvidencia(
    @UploadedFile() archivo: Express.Multer.File,
    @Body() body: SubirEvidenciaDto,
  ) {
    if (!archivo) {
      throw new BadRequestException('El archivo es requerido');
    }

    return this.archivosService.subirEvidencia(
      archivo,
      body.evidenciaId,
      body.jornadaId,
    );
  }

  @Post('evidencia/jornada')
  @RequierePermisos('archivos.subir')
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
    summary: 'Adjuntar evidencia a una jornada',
    description:
      'Crea la evidencia y guarda el archivo (foto, PDF u otro documento) para consultarlo en el expediente.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo', 'jornadaId'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
        jornadaId: { type: 'string', format: 'uuid' },
        tipo: { type: 'string', enum: Object.values(TipoEvidencia) },
      },
    },
  })
  subirEvidenciaDeJornada(
    @UploadedFile() archivo: Express.Multer.File,
    @Body() body: SubirEvidenciaJornadaDto,
  ) {
    if (!archivo) {
      throw new BadRequestException('El archivo es requerido');
    }

    return this.archivosService.subirEvidenciaDeJornada(
      archivo,
      body.jornadaId,
      body.tipo,
    );
  }
}
