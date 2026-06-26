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
import { ArchivosService } from './archivos.service';
import { SubirEvidenciaDto } from './dto/subir-evidencia.dto';

const TIPOS_PERMITIDOS = [
  /^image\//,
  /^application\/pdf$/,
  /^video\/mp4$/,
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
  @ApiOperation({ summary: 'Subir archivo de evidencia' })
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
  @ApiResponse({ status: 201, description: 'Archivo encolado para procesamiento' })
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
}
