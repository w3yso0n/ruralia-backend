import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';

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

async function columnaExiste(
  client: Client,
  tabla: string,
  columna: string,
): Promise<boolean> {
  const r = await client.query(
    `
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    `,
    [tabla, columna],
  );
  return (r.rowCount ?? 0) > 0;
}

async function tablaExiste(client: Client, tabla: string): Promise<boolean> {
  const r = await client.query(
    `
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = $1
    `,
    [tabla],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Prepara el esquema territorial antes del synchronize:
 * - regiones + region_id en departamentos
 * - municipio_id en veredas (relleno desde corregimiento)
 * - corregimiento_id nullable
 */
export async function migrarTerritoriosAntesDeSync(): Promise<void> {
  cargarEnvLocal();

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ruralia',
  });

  await client.connect();
  try {
    if (!(await tablaExiste(client, 'departamentos'))) {
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS regiones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre varchar NOT NULL,
        codigo varchar NOT NULL UNIQUE,
        descripcion text,
        esta_activo boolean NOT NULL DEFAULT true
      )
    `);

    // Región placeholder para departamentos sin región aún
    await client.query(`
      INSERT INTO regiones (id, nombre, codigo, descripcion, esta_activo)
      SELECT gen_random_uuid(), 'Sin clasificar', 'SIN_CLASIFICAR',
             'Placeholder temporal de migración', true
      WHERE NOT EXISTS (
        SELECT 1 FROM regiones WHERE codigo = 'SIN_CLASIFICAR'
      )
    `);

    if (!(await columnaExiste(client, 'departamentos', 'region_id'))) {
      await client.query(`
        ALTER TABLE departamentos
        ADD COLUMN region_id uuid
      `);
      await client.query(`
        UPDATE departamentos d
        SET region_id = r.id
        FROM regiones r
        WHERE d.region_id IS NULL AND r.codigo = 'SIN_CLASIFICAR'
      `);
      await client.query(`
        ALTER TABLE departamentos
        ALTER COLUMN region_id SET NOT NULL
      `);
    } else {
      // Rellenar nulos por si quedó a medias
      await client.query(`
        UPDATE departamentos d
        SET region_id = r.id
        FROM regiones r
        WHERE d.region_id IS NULL AND r.codigo = 'SIN_CLASIFICAR'
      `);
    }

    // Quitar FK con nombre fijo: TypeORM crea el suyo en synchronize
    await client.query(`
      ALTER TABLE departamentos
      DROP CONSTRAINT IF EXISTS fk_departamentos_region
    `);

    if (!(await tablaExiste(client, 'veredas'))) {
      return;
    }

    if (!(await columnaExiste(client, 'veredas', 'municipio_id'))) {
      await client.query(`
        ALTER TABLE veredas
        ADD COLUMN municipio_id uuid
      `);
    }

    if (await columnaExiste(client, 'veredas', 'corregimiento_id')) {
      await client.query(`
        UPDATE veredas v
        SET municipio_id = c.municipio_id
        FROM corregimientos c
        WHERE v.corregimiento_id = c.id
          AND v.municipio_id IS NULL
      `);

      await client.query(`
        ALTER TABLE veredas
        ALTER COLUMN corregimiento_id DROP NOT NULL
      `);
    }

    // Veredas huérfanas: eliminar (solo catálogo) si no hay municipio
    const huerfanas = await client.query(
      `SELECT COUNT(*)::int AS n FROM veredas WHERE municipio_id IS NULL`,
    );
    if ((huerfanas.rows[0]?.n ?? 0) > 0) {
      // Quitar FKs que referencien veredas huérfanas es complejo; asignar
      // a un municipio temporal si existe alguno, si no borrar solo las sin uso.
      await client.query(`
        DELETE FROM veredas v
        WHERE v.municipio_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM proyecto_veredas pv WHERE pv.vereda_id = v.id)
          AND NOT EXISTS (SELECT 1 FROM beneficiarios b WHERE b.vereda_id = v.id)
          AND NOT EXISTS (SELECT 1 FROM asociaciones a WHERE a.vereda_id = v.id)
          AND NOT EXISTS (SELECT 1 FROM jornadas j WHERE j.vereda_id = v.id)
      `);
    }

    const quedanNull = await client.query(
      `SELECT COUNT(*)::int AS n FROM veredas WHERE municipio_id IS NULL`,
    );
    if ((quedanNull.rows[0]?.n ?? 0) > 0) {
      // Crear municipio temporal y asignar
      const mun = await client.query<{ id: string }>(`
        SELECT id FROM municipios LIMIT 1
      `);
      if (mun.rowCount) {
        await client.query(
          `UPDATE veredas SET municipio_id = $1 WHERE municipio_id IS NULL`,
          [mun.rows[0].id],
        );
      }
    }

    await client.query(`
      ALTER TABLE veredas
      ALTER COLUMN municipio_id SET NOT NULL
    `).catch(() => undefined);

    console.log('[migrar-territorios] Esquema territorial preparado.');
  } finally {
    await client.end();
  }
}
