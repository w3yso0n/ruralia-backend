import { BadRequestException } from '@nestjs/common';
import { EstadoFuncional } from './estado-funcional.enum';

/**
 * Máquina de estados tipada (estilo FSM puro).
 * Transiciones del checklist RF-19; validación en un solo lugar.
 */
const TRANSICIONES: Readonly<
  Record<EstadoFuncional, readonly EstadoFuncional[]>
> = {
  [EstadoFuncional.BORRADOR]: [EstadoFuncional.CAPTURADO],
  [EstadoFuncional.CAPTURADO]: [EstadoFuncional.SINCRONIZADO],
  [EstadoFuncional.SINCRONIZADO]: [EstadoFuncional.EN_REVISION],
  [EstadoFuncional.EN_REVISION]: [
    EstadoFuncional.APROBADO,
    EstadoFuncional.RECHAZADO,
  ],
  [EstadoFuncional.RECHAZADO]: [EstadoFuncional.EN_CORRECCION],
  [EstadoFuncional.EN_CORRECCION]: [EstadoFuncional.EN_REVISION],
  [EstadoFuncional.APROBADO]: [], // reapertura solo vía nueva versión (servicio)
};

/** Atajos online: captura que ya vive en servidor puede saltar a SINCRONIZADO. */
const ATAJOS_ONLINE: Readonly<
  Record<string, EstadoFuncional>
> = {
  [`${EstadoFuncional.BORRADOR}->${EstadoFuncional.SINCRONIZADO}`]:
    EstadoFuncional.CAPTURADO,
  [`${EstadoFuncional.CAPTURADO}->${EstadoFuncional.EN_REVISION}`]:
    EstadoFuncional.SINCRONIZADO,
  [`${EstadoFuncional.BORRADOR}->${EstadoFuncional.EN_REVISION}`]:
    EstadoFuncional.CAPTURADO,
};

export function puedeTransicionar(
  desde: EstadoFuncional,
  hacia: EstadoFuncional,
): boolean {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}

/**
 * Avanza estado validando la transición.
 * Con `permitirAtajosOnline` inserta pasos intermedios implícitos
 * (p. ej. BORRADOR → EN_REVISION pasa por CAPTURADO y SINCRONIZADO).
 */
export function transicionarEstado(
  desde: EstadoFuncional,
  hacia: EstadoFuncional,
  opciones: { permitirAtajosOnline?: boolean } = {},
): EstadoFuncional {
  if (desde === hacia) {
    return hacia;
  }

  if (puedeTransicionar(desde, hacia)) {
    return hacia;
  }

  if (opciones.permitirAtajosOnline) {
    const cadena = resolverCadenaAtajo(desde, hacia);
    if (cadena) {
      return hacia;
    }
  }

  throw new BadRequestException(
    `Transición no permitida: ${desde} → ${hacia}`,
  );
}

function resolverCadenaAtajo(
  desde: EstadoFuncional,
  hacia: EstadoFuncional,
): EstadoFuncional[] | null {
  // BFS corto sobre el grafo + atajos
  const cola: EstadoFuncional[][] = [[desde]];
  const visitado = new Set<EstadoFuncional>([desde]);

  while (cola.length > 0) {
    const camino = cola.shift()!;
    const actual = camino[camino.length - 1];
    if (actual === hacia) {
      return camino;
    }

    const siguientes = new Set<EstadoFuncional>([
      ...(TRANSICIONES[actual] ?? []),
    ]);

    for (const [clave, intermedio] of Object.entries(ATAJOS_ONLINE)) {
      const [d, h] = clave.split('->') as [EstadoFuncional, EstadoFuncional];
      if (d === actual) {
        siguientes.add(intermedio);
        siguientes.add(h);
      }
    }

    for (const sig of siguientes) {
      if (!visitado.has(sig)) {
        visitado.add(sig);
        cola.push([...camino, sig]);
      }
    }
  }

  return null;
}

export function estadoEditable(estado: EstadoFuncional): boolean {
  return (
    estado === EstadoFuncional.BORRADOR ||
    estado === EstadoFuncional.CAPTURADO ||
    estado === EstadoFuncional.SINCRONIZADO ||
    estado === EstadoFuncional.EN_CORRECCION ||
    estado === EstadoFuncional.RECHAZADO
  );
}

export function requiereMotivoCorreccion(estado: EstadoFuncional): boolean {
  return (
    estado === EstadoFuncional.SINCRONIZADO ||
    estado === EstadoFuncional.EN_REVISION ||
    estado === EstadoFuncional.EN_CORRECCION ||
    estado === EstadoFuncional.RECHAZADO ||
    estado === EstadoFuncional.APROBADO
  );
}
