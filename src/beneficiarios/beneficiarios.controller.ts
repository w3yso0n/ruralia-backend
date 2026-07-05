import {
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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RolEnum } from '../autenticacion/enums/rol.enum';
import { BeneficiariosService } from './beneficiarios.service';
import {
  ActualizarBeneficiarioDto,
  CrearBeneficiarioDto,
  FiltrosBeneficiarioDto,
} from './dto/beneficiario.dto';
import {
  RespuestaBeneficiarioDto,
  RespuestaPaginadaBeneficiariosDto,
} from './dto/respuesta-beneficiario.dto';

@ApiTags('Beneficiarios')
@ApiBearerAuth('bearer')
@Controller('beneficiarios')
export class BeneficiariosController {
  constructor(private readonly beneficiariosService: BeneficiariosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar beneficiarios' })
  @ApiResponse({ status: 200, type: RespuestaPaginadaBeneficiariosDto })
  listar(
    @Query() filtros: FiltrosBeneficiarioDto,
  ): Promise<RespuestaPaginadaBeneficiariosDto> {
    return this.beneficiariosService.listar(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un beneficiario por ID' })
  @ApiResponse({ status: 200, type: RespuestaBeneficiarioDto })
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RespuestaBeneficiarioDto> {
    return this.beneficiariosService.obtenerUno(id);
  }

  @Post()
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Crear un beneficiario' })
  @ApiResponse({ status: 201, type: RespuestaBeneficiarioDto })
  crear(@Body() dto: CrearBeneficiarioDto): Promise<RespuestaBeneficiarioDto> {
    return this.beneficiariosService.crear(dto);
  }

  @Patch(':id')
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Actualizar un beneficiario' })
  @ApiResponse({ status: 200, type: RespuestaBeneficiarioDto })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarBeneficiarioDto,
  ): Promise<RespuestaBeneficiarioDto> {
    return this.beneficiariosService.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(RolEnum.ADMINISTRADOR, RolEnum.COORDINADOR)
  @ApiOperation({ summary: 'Desactivar un beneficiario' })
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.beneficiariosService.eliminar(id);
  }
}
