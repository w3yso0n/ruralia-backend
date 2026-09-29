import {
  BadRequestException,
  Controller,
  Delete,
  Get,
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
import { RespuestaUsuarioDto } from '../usuarios/dto/respuesta-usuario.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { aRespuestaUsuario } from '../usuarios/utils/serializar-usuario';
import {
  AutenticacionService,
  TIPOS_FOTO_PERFIL,
} from './autenticacion.service';
import { SoloAutenticado } from './decorators/solo-autenticado.decorator';
import { UsuarioActual } from './decorators/usuario-actual.decorator';

const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;

@ApiTags('Autenticación')
@ApiBearerAuth('bearer')
@Controller('autenticacion')
export class AutenticacionController {
  constructor(private readonly autenticacionService: AutenticacionService) {}

  @Get('yo')
  @SoloAutenticado()
  @ApiOperation({
    summary: 'Obtener perfil del usuario autenticado',
    description:
      'Devuelve los datos del usuario actual, roles y permisos efectivos.',
  })
  @ApiResponse({ status: 200, type: RespuestaUsuarioDto })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  obtenerYo(@UsuarioActual() usuario: Usuario): RespuestaUsuarioDto {
    return aRespuestaUsuario(usuario);
  }

  @Post('yo/foto')
  @SoloAutenticado()
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: TAMANO_MAXIMO_FOTO },
      fileFilter: (_req, file, callback) => {
        if (!TIPOS_FOTO_PERFIL.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              'Formato no permitido. Usa una imagen JPG, PNG o WebP',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Actualizar foto de perfil del usuario autenticado',
    description: 'Acepta JPG, PNG o WebP de hasta 5 MB.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, type: RespuestaUsuarioDto })
  @ApiResponse({ status: 400, description: 'Archivo inválido o faltante' })
  async subirFoto(
    @UsuarioActual() usuario: Usuario,
    @UploadedFile() archivo: Express.Multer.File,
  ): Promise<RespuestaUsuarioDto> {
    if (!archivo) {
      throw new BadRequestException('La imagen es requerida');
    }
    const actualizado = await this.autenticacionService.actualizarFotoPerfil(
      usuario,
      archivo,
    );
    return aRespuestaUsuario(actualizado);
  }

  @Delete('yo/foto')
  @SoloAutenticado()
  @ApiOperation({ summary: 'Quitar foto de perfil del usuario autenticado' })
  @ApiResponse({ status: 200, type: RespuestaUsuarioDto })
  async eliminarFoto(
    @UsuarioActual() usuario: Usuario,
  ): Promise<RespuestaUsuarioDto> {
    const actualizado =
      await this.autenticacionService.eliminarFotoPerfil(usuario);
    return aRespuestaUsuario(actualizado);
  }
}
