export interface PersonaPool {
  id: string;
  rolIds: string[];
  activo: boolean;
}

export interface NivelAsignable {
  orden: number;
  usuarioId: string | null;
  rolId: string | null;
}

/**
 * Avisa por candidatos efectivos, no por “la misma persona aparece dos veces”.
 * Quien está fijado en un nivel anterior sale del pool. Un rol de una sola
 * persona también queda ocupado: después de ese nivel nadie más puede actuar.
 * Un rol con varias personas no ocupa a todas, porque solo una aprueba.
 */
export function advertenciasNiveles(
  niveles: NivelAsignable[],
  personal: PersonaPool[],
): string[] {
  const ocupados = new Set<string>();
  const avisos: string[] = [];
  const activos = personal.filter((p) => p.activo);

  for (const nivel of [...niveles].sort((a, b) => a.orden - b.orden)) {
    if (nivel.usuarioId) {
      if (ocupados.has(nivel.usuarioId)) {
        avisos.push(
          `El nivel ${nivel.orden} queda sin candidato: esa persona ya está reservada en un nivel anterior.`,
        );
      } else if (!activos.some((p) => p.id === nivel.usuarioId)) {
        avisos.push(
          `El nivel ${nivel.orden} asigna a alguien que no está activo en el personal del proyecto.`,
        );
      }
      ocupados.add(nivel.usuarioId);
      continue;
    }

    const pool = activos.filter(
      (p) =>
        nivel.rolId != null &&
        p.rolIds.includes(nivel.rolId) &&
        !ocupados.has(p.id),
    );
    if (pool.length === 0) {
      avisos.push(
        `El nivel ${nivel.orden} no tiene candidatos efectivos después de reservar a quienes ya están en niveles anteriores.`,
      );
    } else if (pool.length === 1) {
      ocupados.add(pool[0].id);
    }
  }

  return avisos;
}

/** Personas que todavía pueden actuar el paso, ya descartados técnico y aprobadores de otros niveles. */
export function candidatosDePaso(
  paso: NivelAsignable,
  personal: PersonaPool[],
  excluir: Set<string>,
): PersonaPool[] {
  return personal.filter((p) => {
    if (!p.activo || excluir.has(p.id)) return false;
    if (paso.usuarioId) return p.id === paso.usuarioId;
    return paso.rolId != null && p.rolIds.includes(paso.rolId);
  });
}
