const LARGO_MAXIMO = 120;

/** Marcador temporal para proteger la ñ al quitar acentos (área de uso privado). */
const MARCA_ENE = '\uE000';

/** Nombre tal como se muestra: sin espacios sobrantes. Vacío si no hay texto. */
export function limpiarNombreLinea(valor: string | null | undefined): string {
  if (!valor) return '';
  return valor.replace(/\s+/g, ' ').trim().slice(0, LARGO_MAXIMO);
}

/**
 * Llave de comparación: minúsculas, sin acentos y sin espacios sobrantes.
 * La ñ se conserva para no mezclar "ñame" con "name".
 */
export function claveLineaProductiva(valor: string | null | undefined): string {
  const limpio = limpiarNombreLinea(valor).toLowerCase();
  if (!limpio) return '';
  return limpio
    .replace(/ñ/g, MARCA_ENE)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(MARCA_ENE)
    .join('ñ');
}

/** Versión más laxa para sugerir duplicados: además quita plurales simples y signos. */
function claveParecida(valor: string): string {
  return claveLineaProductiva(valor)
    .replace(/[^a-zñ0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((palabra) => {
      if (palabra.length > 4 && palabra.endsWith('es'))
        return palabra.slice(0, -2);
      if (palabra.length > 3 && palabra.endsWith('s'))
        return palabra.slice(0, -1);
      return palabra;
    })
    .join(' ');
}

function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  const previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previa[0];
    previa[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temporal = previa[j];
      previa[j] = Math.min(
        previa[j] + 1,
        previa[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = temporal;
    }
  }
  return previa[b.length];
}

/**
 * Agrupa líneas con nombres casi iguales ("Mango" / "Mangos", "Platano" / "Plátanos",
 * un error de una letra). Solo sugiere: unificar lo decide una persona.
 */
export function agruparPosiblesDuplicados<
  T extends { id: string; nombre: string },
>(lineas: T[]): T[][] {
  const claves = lineas.map((l) => claveParecida(l.nombre));
  const padre = lineas.map((_, i) => i);
  const raiz = (i: number): number =>
    padre[i] === i ? i : (padre[i] = raiz(padre[i]));

  for (let i = 0; i < lineas.length; i++) {
    for (let j = i + 1; j < lineas.length; j++) {
      const a = claves[i];
      const b = claves[j];
      if (!a || !b) continue;
      const parecidas =
        a === b || (Math.min(a.length, b.length) >= 5 && distancia(a, b) <= 1);
      if (parecidas) padre[raiz(i)] = raiz(j);
    }
  }

  const grupos = new Map<number, T[]>();
  lineas.forEach((linea, i) => {
    const r = raiz(i);
    grupos.set(r, [...(grupos.get(r) ?? []), linea]);
  });
  return [...grupos.values()].filter((g) => g.length > 1);
}
