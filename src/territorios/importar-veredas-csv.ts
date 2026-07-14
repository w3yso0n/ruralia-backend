/**
 * Importa el catálogo DANE de veredas desde CRVeredas_2020_limpio.csv.
 *
 * Uso (desde ruralia-backend):
 *   pnpm run seed:territorios
 *
 * Idempotente: upsert por código (COD_DPTO, DPTOMPIO, CODIGO_VER).
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
  const TAMANO_LOTE = 400;
  let filas = 0;
  let veredasUpsert = 0;
  const lote: FilaCsv[] = [];

  async function flush(): Promise<void> {
    if (!lote.length) return;
    const filasLote = lote.splice(0, lote.length);

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

      let deptId = deptCache.get(codDpto);
      if (!deptId) {
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
        deptId = d.rows[0]?.id;
        if (!deptId) throw new Error(`No se pudo upsert departamento ${codDpto}`);
        deptCache.set(codDpto, deptId);
      }

      let munId = munCache.get(codMun);
      if (!munId) {
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
        munId = m.rows[0]?.id;
        if (!munId) throw new Error(`No se pudo upsert municipio ${codMun}`);
        munCache.set(codMun, munId);
      }

      await client.query(
        `
        INSERT INTO veredas (id, nombre, codigo, esta_activo, municipio_id, corregimiento_id)
        VALUES (gen_random_uuid(), $1, $2, true, $3, NULL)
        ON CONFLICT (codigo) DO UPDATE
          SET nombre = EXCLUDED.nombre,
              municipio_id = EXCLUDED.municipio_id,
              esta_activo = true
        `,
        [nomVer, codVer, munId],
      );
      veredasUpsert += 1;
    }

    process.stdout.write(
      `\rProcesadas ${filas} filas · veredas upsert ${veredasUpsert}…`,
    );
  }

  console.log(`Importando ${csvPath}…`);
  await client.query('BEGIN');
  try {
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

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

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
