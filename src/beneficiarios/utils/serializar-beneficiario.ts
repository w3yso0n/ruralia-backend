import { plainToInstance } from 'class-transformer';
import { Beneficiario } from '../entities/beneficiario.entity';
import {
  RespuestaBeneficiarioDto,
  RespuestaPaginadaBeneficiariosDto,
} from '../dto/respuesta-beneficiario.dto';

export function aRespuestaBeneficiario(
  beneficiario: Beneficiario,
): RespuestaBeneficiarioDto {
  return plainToInstance(RespuestaBeneficiarioDto, beneficiario, {
    excludeExtraneousValues: true,
  });
}

export function aRespuestaPaginadaBeneficiarios(
  datos: RespuestaBeneficiarioDto[],
  total: number,
  pagina: number,
  limite: number,
): RespuestaPaginadaBeneficiariosDto {
  return plainToInstance(
    RespuestaPaginadaBeneficiariosDto,
    {
      datos,
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite) || 0,
    },
    { excludeExtraneousValues: true },
  );
}
