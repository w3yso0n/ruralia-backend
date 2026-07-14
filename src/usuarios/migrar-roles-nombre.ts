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
 * Convierte roles.nombre de enum Postgres a varchar ANTES del synchronize de TypeORM.
 * TypeORM changeColumn enum→varchar deja nulls y falla con NOT NULL.
 */
export async function migrarRolesNombreAntesDeSync(): Promise<void> {
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
    const existeTabla = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'roles'
    `);
    if (!existeTabla.rowCount) {
      return;
    }

    const col = await client.query<{
      udt_name: string;
      data_type: string;
    }>(`
      SELECT udt_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'roles'
        AND column_name = 'nombre'
    `);

    if (!col.rowCount) {
      return;
    }

    const udt = col.rows[0].udt_name;
    const esEnum =
      col.rows[0].data_type === 'USER-DEFINED' || udt.includes('enum');

    if (esEnum) {
      await client.query(`
        ALTER TABLE roles
        ALTER COLUMN nombre TYPE varchar(80)
        USING nombre::text
      `);
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roles_nombre_enum') THEN
            DROP TYPE roles_nombre_enum;
          END IF;
        END $$;
      `);
      // eslint-disable-next-line no-console
      console.log(
        '[migracion] roles.nombre convertido de enum a varchar(80)',
      );
    }

    await client.query(`
      ALTER TABLE roles
      ADD COLUMN IF NOT EXISTS es_sistema boolean NOT NULL DEFAULT false
    `);
    await client.query(`
      ALTER TABLE roles
      ADD COLUMN IF NOT EXISTS esta_activo boolean NOT NULL DEFAULT true
    `);
    await client.query(`
      UPDATE roles
      SET es_sistema = true
      WHERE nombre IN (
        'CUANTIVA',
        'ADMINISTRADOR',
        'COORDINADOR_DEPARTAMENTAL',
        'COORDINADOR_ZONA',
        'CAMPO',
        'VISUALIZADOR',
        'COORDINADOR',
        'TECNICO'
      )
    `);
  } finally {
    await client.end();
  }
}
