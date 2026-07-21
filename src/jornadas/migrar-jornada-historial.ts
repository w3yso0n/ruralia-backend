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

async function tieneColumna(
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

async function tieneTabla(client: Client, tabla: string): Promise<boolean> {
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
 * Pre-sync:
 * 1) Revertir jornada_beneficiarios a join M2M puro (sin snapshot/expediente).
 * 2) Mantener tecnico_responsable_nombre en jornadas (4 pasos).
 */
export async function migrarJornadaHistorialAntesDeSync(): Promise<void> {
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
    if (await tieneTabla(client, 'jornada_beneficiarios')) {
      const necesitaLimpieza =
        (await tieneColumna(client, 'jornada_beneficiarios', 'id')) ||
        (await tieneColumna(client, 'jornada_beneficiarios', 'nombres')) ||
        (await tieneColumna(client, 'jornada_beneficiarios', 'origen_registro'));

      if (necesitaLimpieza) {
        // Recrear join puro conservando pares únicos (jornada_id, beneficiario_id)
        await client.query(`
          CREATE TABLE IF NOT EXISTS jornada_beneficiarios_tmp (
            jornada_id uuid NOT NULL,
            beneficiario_id uuid NOT NULL,
            PRIMARY KEY (jornada_id, beneficiario_id)
          )
        `);
        await client.query(`
          INSERT INTO jornada_beneficiarios_tmp (jornada_id, beneficiario_id)
          SELECT DISTINCT jornada_id, beneficiario_id
          FROM jornada_beneficiarios
          ON CONFLICT DO NOTHING
        `);
        await client.query(`DROP TABLE jornada_beneficiarios CASCADE`);
        await client.query(
          `ALTER TABLE jornada_beneficiarios_tmp RENAME TO jornada_beneficiarios`,
        );
        await client.query(`
          DO $$ BEGIN
            ALTER TABLE jornada_beneficiarios
            ADD CONSTRAINT "FK_jornada_beneficiarios_jornada"
            FOREIGN KEY (jornada_id) REFERENCES jornadas(id)
            ON DELETE CASCADE;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$;
        `);
        await client.query(`
          DO $$ BEGIN
            ALTER TABLE jornada_beneficiarios
            ADD CONSTRAINT "FK_jornada_beneficiarios_beneficiario"
            FOREIGN KEY (beneficiario_id) REFERENCES beneficiarios(id)
            ON DELETE CASCADE;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$;
        `);
      }

      await client.query(`
        DROP TYPE IF EXISTS origen_registro_jornada_beneficiario_enum;
      `);
    }

    // tecnico_responsable_nombre — 4 pasos
    if (await tieneTabla(client, 'jornadas')) {
      if (
        !(await tieneColumna(client, 'jornadas', 'tecnico_responsable_nombre'))
      ) {
        await client.query(`
          ALTER TABLE jornadas
          ADD COLUMN tecnico_responsable_nombre varchar
        `);
      }

      await client.query(`
        UPDATE jornadas j
        SET tecnico_responsable_nombre = u.nombre_completo
        FROM usuarios u
        WHERE u.id = j.tecnico_responsable_id
          AND (j.tecnico_responsable_nombre IS NULL OR j.tecnico_responsable_nombre = '')
      `);

      await client.query(`
        UPDATE jornadas
        SET tecnico_responsable_nombre = '(sin nombre)'
        WHERE tecnico_responsable_nombre IS NULL
      `);

      const restantes = await client.query(`
        SELECT COUNT(*)::int AS n FROM jornadas
        WHERE tecnico_responsable_nombre IS NULL
      `);
      if (restantes.rows[0].n === 0) {
        await client.query(`
          ALTER TABLE jornadas
          ALTER COLUMN tecnico_responsable_nombre SET NOT NULL
        `);
      }
    }
  } finally {
    await client.end();
  }
}
