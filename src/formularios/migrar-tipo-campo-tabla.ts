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
 * TypeORM synchronize no añade valores nuevos a enums de Postgres de forma fiable.
 * Asegura que 'TABLA' exista en el enum de tipo_campo antes del sync.
 */
export async function migrarTipoCampoTablaAntesDeSync(): Promise<void> {
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
    const col = await client.query(
      `
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'campos_formulario'
        AND column_name = 'tipo_campo'
      `,
    );

    if ((col.rowCount ?? 0) === 0) {
      return;
    }

    const enumName = col.rows[0].udt_name as string;

    const existe = await client.query(
      `
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = $1 AND e.enumlabel = 'TABLA'
      `,
      [enumName],
    );

    if ((existe.rowCount ?? 0) > 0) {
      return;
    }

    await client.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS 'TABLA'`);
  } finally {
    await client.end();
  }
}
