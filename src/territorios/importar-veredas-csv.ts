/**
 * Importa el catálogo DANE de veredas desde CRVeredas_2020_limpio.csv.
 *
 * Uso (desde ruralia-backend):
 *   pnpm run seed:territorios
 *
 * Idempotente: upsert por código (COD_DPTO, DPTOMPIO, CODIGO_VER).
 * No borra territorios existentes; si el código ya está, actualiza nombre/municipio
 * y conserva el id (las relaciones de proyectos y beneficiarios se mantienen).
 */
import { createReadStream, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'fast-csv';
import { Client } from 'pg';
import {
  REGIONES_NATURALES,
  codigoRegionParaDepartamento,
  padCodigoDepartamento,
} from './regiones-colombia';

function cargarEnvLocal(): void {
  const ruta = resolve(process.cwd(), '.env');
  if (!existsSync(ruta)) return;
  const contenido = readFileSync(ruta, 'utf8');
  for (const linea of contenido.split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const clave = t.slice(0, eq).trim();
    let valor = t.slice(eq + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (process.env[clave] === undefined) {
      process.env[clave] = valor;
    }
  }
}

function titulo(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'])\S/g, (c) => c.toUpperCase());
}

type FilaCsv = {
  COD_DPTO: string;
  NOM_DEP: string;
  DPTOMPIO: string;
  NOMB_MPIO: string;
  CODIGO_VER: string;
  NOMBRE_VER: string;
};

async function main(): Promise<void> {
  cargarEnvLocal();

  const csvPath =
    process.argv[2] || resolve(process.cwd(), 'CRVeredas_2020_limpio.csv');

  if (!existsSync(csvPath)) {
    throw new Error(`No se encontró el CSV: ${csvPath}`);
  }

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ruralia',
  });

  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  console.log('Sembrando regiones naturales…');
  const regionIds = new Map<string, string>();
  for (const r of REGIONES_NATURALES) {
    const row = await client.query<{ id: string }>(
      `
      INSERT INTO regiones (id, nombre, codigo, descripcion, esta_activo)
      VALUES (gen_random_uuid(), $1, $2, $3, true)
      ON CONFLICT (codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            descripcion = COALESCE(EXCLUDED.descripcion, regiones.descripcion)
      RETURNING id
      `,
      [r.nombre, r.codigo, r.descripcion],
    );
    regionIds.set(r.codigo, row.rows[0].id);
  }

  const deptCache = new Map<string, string>();
  const munCache = new Map<string, string>();
  const TAMANO_LOTE = 1000;
  let filas = 0;
  let veredasUpsert = 0;
  const lote: FilaCsv[] = [];

  async function asegurarDepartamento(
    codDpto: string,
    nomDpto: string,
  ): Promise<string> {
    const cached = deptCache.get(codDpto);
    if (cached) return cached;
    const codigoRegion = codigoRegionParaDepartamento(codDpto);
    const regionId =
      regionIds.get(codigoRegion) ?? regionIds.get('SIN_CLASIFICAR')!;
    const d = await client.query<{ id: string }>(
      `
      INSERT INTO departamentos (id, nombre, codigo, esta_activo, region_id)
      VALUES (gen_random_uuid(), $1, $2, true, $3)
      ON CONFLICT (codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            region_id = EXCLUDED.region_id,
            esta_activo = true
      RETURNING id
      `,
      [nomDpto, codDpto, regionId],
    );
    const deptId = d.rows[0]?.id;
    if (!deptId) throw new Error(`No se pudo upsert departamento ${codDpto}`);
    deptCache.set(codDpto, deptId);
    return deptId;
  }

  async function asegurarMunicipio(
    codMun: string,
    nomMun: string,
    deptId: string,
  ): Promise<string> {
    const cached = munCache.get(codMun);
    if (cached) return cached;
    const m = await client.query<{ id: string }>(
      `
      INSERT INTO municipios (id, nombre, codigo, esta_activo, departamento_id)
      VALUES (gen_random_uuid(), $1, $2, true, $3)
      ON CONFLICT (codigo) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            departamento_id = EXCLUDED.departamento_id,
            esta_activo = true
      RETURNING id
      `,
      [nomMun, codMun, deptId],
    );
    const munId = m.rows[0]?.id;
    if (!munId) throw new Error(`No se pudo upsert municipio ${codMun}`);
    munCache.set(codMun, munId);
    return munId;
  }

  async function flush(): Promise<void> {
    if (!lote.length) return;
    const filasLote = lote.splice(0, lote.length);

    const porCodigo = new Map<
      string,
      { nombre: string; municipioId: string }
    >();

    for (const fila of filasLote) {
      const codDpto = padCodigoDepartamento(fila.COD_DPTO);
      const nomDpto = titulo(fila.NOM_DEP || '');
      const codMun = String(fila.DPTOMPIO ?? '')
        .trim()
        .padStart(5, '0');
      const nomMun = titulo(fila.NOMB_MPIO || '');
      const codVer = String(fila.CODIGO_VER ?? '').trim();
      const nomVer = titulo(fila.NOMBRE_VER || '');

      if (!codVer || !nomVer || !codMun || !codDpto) continue;

      const deptId = await asegurarDepartamento(codDpto, nomDpto);
      const munId = await asegurarMunicipio(codMun, nomMun, deptId);
      porCodigo.set(codVer, { nombre: nomVer, municipioId: munId });
    }

    const nombres: string[] = [];
    const codigos: string[] = [];
    const municipioIds: string[] = [];
    for (const [codigo, v] of porCodigo) {
      nombres.push(v.nombre);
      codigos.push(codigo);
      municipioIds.push(v.municipioId);
    }

    if (nombres.length) {
      await client.query(
        `
        INSERT INTO veredas (id, nombre, codigo, esta_activo, municipio_id, corregimiento_id)
        SELECT gen_random_uuid(), x.nombre, x.codigo, true, x.municipio_id, NULL
        FROM unnest($1::text[], $2::text[], $3::uuid[]) AS x(nombre, codigo, municipio_id)
        ON CONFLICT (codigo) DO UPDATE
          SET nombre = EXCLUDED.nombre,
              municipio_id = EXCLUDED.municipio_id,
              esta_activo = true
        `,
        [nombres, codigos, municipioIds],
      );
      veredasUpsert += nombres.length;
    }

    process.stdout.write(
      `\rProcesadas ${filas} filas · veredas upsert ${veredasUpsert}…`,
    );
  }

  console.log(`Importando ${csvPath}…`);
  await new Promise<void>((resolvePromise, reject) => {
      const stream = createReadStream(csvPath).pipe(
        parse({ headers: true, trim: true }),
      );
      let cadena: Promise<void> = Promise.resolve();

      stream.on('data', (row: FilaCsv) => {
        filas += 1;
        lote.push(row);
        if (lote.length >= TAMANO_LOTE) {
          stream.pause();
          cadena = cadena
            .then(() => flush())
            .then(() => {
              stream.resume();
            })
            .catch((err) => {
              stream.destroy(err);
              reject(err);
            });
        }
      });

      stream.on('error', reject);
      stream.on('end', () => {
        cadena
          .then(() => flush())
          .then(() => resolvePromise())
          .catch(reject);
      });
    });

  const counts = await client.query<{
    regiones: string;
    departamentos: string;
    municipios: string;
    veredas: string;
  }>(`
    SELECT
      (SELECT COUNT(*)::text FROM regiones) AS regiones,
      (SELECT COUNT(*)::text FROM departamentos) AS departamentos,
      (SELECT COUNT(*)::text FROM municipios) AS municipios,
      (SELECT COUNT(*)::text FROM veredas WHERE esta_activo) AS veredas
  `);

  console.log('\nImportación completada.');
  console.log(counts.rows[0]);
  await client.end();
}

main().catch((err) => {
  console.error('\nError importando territorios:', err);
  process.exit(1);
});
