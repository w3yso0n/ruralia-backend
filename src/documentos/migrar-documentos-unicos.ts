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

/**
 * Deja un solo documento por jornada y tipo antes de crear el índice único.
 * Las versiones de los duplicados pasan al documento que se conserva.
 */
export async function migrarDocumentosUnicosAntesDeSync(): Promise<void> {
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
    const tabla = await client.query(
      `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'documents'
      `,
    );
    if ((tabla.rowCount ?? 0) === 0) return;

    await client.query('BEGIN');

    await client.query(`
      CREATE TEMP TABLE documentos_duplicados ON COMMIT DROP AS
      WITH ranked AS (
        SELECT
          id,
          jornada_id,
          tipo,
          ROW_NUMBER() OVER (
            PARTITION BY jornada_id, tipo
            ORDER BY
              (version_vigente_id IS NOT NULL) DESC,
              creado_en DESC,
              id DESC
          ) AS rn
        FROM documents
      )
      SELECT r.id AS dupe_id, k.id AS keeper_id
      FROM ranked r
      JOIN ranked k
        ON k.jornada_id = r.jornada_id
       AND k.tipo = r.tipo
       AND k.rn = 1
      WHERE r.rn > 1
    `);

    const dupes = await client.query(
      'SELECT COUNT(*)::int AS total FROM documentos_duplicados',
    );
    const total = Number(dupes.rows[0]?.total ?? 0);
    if (total === 0) {
      await client.query('COMMIT');
      return;
    }

    await client.query(`
      UPDATE document_versions v
      SET document_id = d.keeper_id
      FROM documentos_duplicados d
      WHERE v.document_id = d.dupe_id
    `);

    await client.query(`
      WITH ordered AS (
        SELECT
          v.id,
          ROW_NUMBER() OVER (
            PARTITION BY v.document_id
            ORDER BY v.version_number ASC, v.created_at ASC, v.id ASC
          ) AS n
        FROM document_versions v
        WHERE v.document_id IN (SELECT keeper_id FROM documentos_duplicados)
      )
      UPDATE document_versions v
      SET version_number = o.n
      FROM ordered o
      WHERE v.id = o.id
    `);

    await client.query(`
      UPDATE documents doc
      SET version_vigente_id = vigente.id
      FROM (
        SELECT DISTINCT ON (document_id) id, document_id
        FROM document_versions
        WHERE document_id IN (SELECT keeper_id FROM documentos_duplicados)
        ORDER BY document_id, version_number DESC
      ) vigente
      WHERE doc.id = vigente.document_id
    `);

    for (const tablaRef of ['audit_logs', 'approvals', 'rejections']) {
      const existe = await client.query(
        `
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = 'document_id'
        `,
        [tablaRef],
      );
      if ((existe.rowCount ?? 0) === 0) continue;
      await client.query(`
        UPDATE ${tablaRef} t
        SET document_id = d.keeper_id
        FROM documentos_duplicados d
        WHERE t.document_id = d.dupe_id
      `);
    }

    await client.query(`
      DELETE FROM documents
      WHERE id IN (SELECT dupe_id FROM documentos_duplicados)
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
