import { ProyectoBeneficiario } from '../entities/proyecto-beneficiario.entity';
import { RespuestaBeneficiarioResumenDto } from '../dto/respuesta-proyecto.dto';
import { Beneficiario } from '../../beneficiarios/entities/beneficiario.entity';

export function resumenDeBeneficiario(
  b: Beneficiario | null | undefined,
): RespuestaBeneficiarioResumenDto | undefined {
  if (!b) return undefined;
  return {
    id: b.id,
    nombres: b.nombres,
    apellidos: b.apellidos,
    numeroDocumento: b.numeroDocumento,
  };
}

export function mapearVinculoBeneficiario(
  pb: ProyectoBeneficiario,
): RespuestaBeneficiarioResumenDto | null {
  const b = pb.beneficiario;
  if (!b) return null;
  return {
    id: b.id,
    nombres: b.nombres,
    apellidos: b.apellidos,
    numeroDocumento: b.numeroDocumento,
    estaActivoEnProyecto: pb.estaActivoEnProyecto,
    reemplazaA: resumenDeBeneficiario(pb.reemplazaA ?? undefined),
    reemplazadoPor: resumenDeBeneficiario(pb.reemplazadoPor ?? undefined),
    reemplazadoEn: pb.reemplazadoEn,
  };
}

export function partirVinculosBeneficiarios(vinculos: ProyectoBeneficiario[]): {
  activos: RespuestaBeneficiarioResumenDto[];
  reemplazados: RespuestaBeneficiarioResumenDto[];
} {
  const activos: RespuestaBeneficiarioResumenDto[] = [];
  const reemplazados: RespuestaBeneficiarioResumenDto[] = [];
  for (const vinculo of vinculos) {
    const mapped = mapearVinculoBeneficiario(vinculo);
    if (!mapped) continue;
    if (vinculo.estaActivoEnProyecto) activos.push(mapped);
    else reemplazados.push(mapped);
  }
  return { activos, reemplazados };
}
