const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function cargarEnv() {
  const contenido = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const linea of contenido.split(/\r?\n/)) {
    const recortada = linea.trim();
    if (!recortada || recortada.startsWith('#')) continue;
    const indice = recortada.indexOf('=');
    if (indice === -1) continue;
    const clave = recortada.slice(0, indice).trim();
    let valor = recortada.slice(indice + 1).trim();
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

cargarEnv();

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
    connectionTimeoutMillis: 20000,
  });

  await client.connect();

  const { rows } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    ['ruralia'],
  );

  if (rows.length === 0) {
    await client.query('CREATE DATABASE ruralia');
    console.log('OK: base de datos ruralia creada');
  } else {
    console.log('OK: la base ruralia ya existe');
  }

  await client.end();
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
