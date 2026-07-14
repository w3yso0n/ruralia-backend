/**
 * Regiones naturales de Colombia y mapeo departamento (código DANE) → región.
 * Criterio: región predominante del departamento (uso pedagógico / operativo estándar).
 */
export const REGIONES_NATURALES = [
  {
    codigo: 'CARIBE',
    nombre: 'Caribe',
    descripcion:
      'Costa atlántica: planicies y costas del norte (Atlántico, Bolívar, Cesar, Córdoba, La Guajira, Magdalena, Sucre).',
  },
  {
    codigo: 'ANDINA',
    nombre: 'Andina',
    descripcion:
      'Cordillera de los Andes: mayor densidad poblacional e industrial del país.',
  },
  {
    codigo: 'PACIFICO',
    nombre: 'Pacífica',
    descripcion:
      'Litoral y vertiente del Pacífico (Chocó, Valle del Cauca, Cauca, Nariño).',
  },
  {
    codigo: 'ORINOQUIA',
    nombre: 'Orinoquía',
    descripcion: 'Llanos orientales (Arauca, Casanare, Meta, Vichada).',
  },
  {
    codigo: 'AMAZONIA',
    nombre: 'Amazonía',
    descripcion:
      'Selva amazónica (Amazonas, Caquetá, Guainía, Guaviare, Putumayo, Vaupés).',
  },
  {
    codigo: 'INSULAR',
    nombre: 'Insular',
    descripcion:
      'Archipiélago de San Andrés, Providencia y Santa Catalina (e islas del Pacífico de referencia).',
  },
  {
    codigo: 'SIN_CLASIFICAR',
    nombre: 'Sin clasificar',
    descripcion:
      'Territorios creados fuera del catálogo DANE (p. ej. resoluciones de Google Places).',
  },
] as const;

/** Código DANE del departamento (2 dígitos) → código de región. */
export const REGION_POR_CODIGO_DEPARTAMENTO: Record<string, string> = {
  '91': 'AMAZONIA', // Amazonas
  '05': 'ANDINA', // Antioquia
  '81': 'ORINOQUIA', // Arauca
  '08': 'CARIBE', // Atlántico
  '11': 'ANDINA', // Bogotá, D.C.
  '13': 'CARIBE', // Bolívar
  '15': 'ANDINA', // Boyacá
  '17': 'ANDINA', // Caldas
  '18': 'AMAZONIA', // Caquetá
  '85': 'ORINOQUIA', // Casanare
  '19': 'PACIFICO', // Cauca
  '20': 'CARIBE', // Cesar
  '27': 'PACIFICO', // Chocó
  '23': 'CARIBE', // Córdoba
  '25': 'ANDINA', // Cundinamarca
  '94': 'AMAZONIA', // Guainía
  '95': 'AMAZONIA', // Guaviare
  '41': 'ANDINA', // Huila
  '44': 'CARIBE', // La Guajira
  '47': 'CARIBE', // Magdalena
  '50': 'ORINOQUIA', // Meta
  '52': 'PACIFICO', // Nariño
  '54': 'ANDINA', // Norte de Santander
  '86': 'AMAZONIA', // Putumayo
  '63': 'ANDINA', // Quindío
  '66': 'ANDINA', // Risaralda
  '88': 'INSULAR', // San Andrés
  '68': 'ANDINA', // Santander
  '70': 'CARIBE', // Sucre
  '73': 'ANDINA', // Tolima
  '76': 'PACIFICO', // Valle del Cauca
  '97': 'AMAZONIA', // Vaupés
  '99': 'ORINOQUIA', // Vichada
};

export function padCodigoDepartamento(codigo: string): string {
  const solo = String(codigo).replace(/\D/g, '');
  return solo.padStart(2, '0').slice(-2);
}

export function codigoRegionParaDepartamento(codigoDpto: string): string {
  const pad = padCodigoDepartamento(codigoDpto);
  return REGION_POR_CODIGO_DEPARTAMENTO[pad] ?? 'SIN_CLASIFICAR';
}
