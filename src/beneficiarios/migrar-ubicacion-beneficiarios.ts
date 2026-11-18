/**
 * Pasa la ubicación propia del beneficiario (predio) desde los datos
 * adicionales dinámicos (`datos_adicionales.latitud/longitud/altitud_m_s_n_m`,
 * cargados desde la matriz de Excel) a las columnas de la entidad
 * `beneficiarios.latitud / longitud / altitud`.
 *
 * No es la ubicación de la vereda: esa no se toca.
 *
 * Uso:
 *   pnpm migrar:ubicacion-beneficiarios                 -> solo reporte (no escribe)
 *   pnpm migrar:ubicacion-beneficiarios --aplicar       -> escribe las válidas
 *   ... --aplicar --limpiar-dinamicos                   -> además quita las claves
 *       dinámicas de las filas migradas (las pendientes conservan su texto)
 *
 * Siempre deja un CSV con el valor original y el resultado de cada fila.
 * Las ubicaciones ambiguas no se adivinan: quedan pendientes de revisión.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';
import {
  ETIQUETA_MOTIVO_COORDENADA,
  interpretarAltitud,
  interpretarUbicacion,
} from './utils/coordenadas';

const CLAVE_LAT = 'latitud';
const CLAVE_LNG = 'longitud';
const CLAVE_ALT = 'altitud_m_s_n_m';

function cargarEnvLocal(): void {
  const ruta = resolve(process.cwd(), '.env');
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
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
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

function csv(valor: unknown): string {
  const texto =
    valor === null || valor === undefined
      ? ''
      : typeof valor === 'string'
        ? valor
        : JSON.stringify(valor);
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

interface FilaOrigen {
  id: string;
  numero_documento: string;
  lat: string | null;
  lng: string | null;
  alt: string | null;
  latitud_actual: number | null;
}

async function main(): Promise<void> {
  cargarEnvLocal();
  const aplicar = process.argv.includes('--aplicar');
  const limpiar = process.argv.includes('--limpiar-dinamicos');

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'ruralia',
  });
  await client.connect();

  try {
    const columnas = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'beneficiarios'
         AND column_name IN ('latitud', 'longitud', 'altitud')`,
    );
    const existenColumnas = columnas.rowCount === 3;

    if (aplicar) {
      // Mismo tipo que la entidad: synchronize no verá diferencias después.
      await client.query(`
        ALTER TABLE beneficiarios
          ADD COLUMN IF NOT EXISTS latitud double precision,
          ADD COLUMN IF NOT EXISTS longitud double precision,
          ADD COLUMN IF NOT EXISTS altitud double precision,
          ADD COLUMN IF NOT EXISTS ubicacion_fuente character varying(20),
          ADD COLUMN IF NOT EXISTS ubicacion_origen_gps character varying(20),
          ADD COLUMN IF NOT EXISTS ubicacion_precision_m double precision,
          ADD COLUMN IF NOT EXISTS ubicacion_capturada_en timestamp with time zone,
          ADD COLUMN IF NOT EXISTS ubicacion_envio_id uuid,
          ADD COLUMN IF NOT EXISTS ubicacion_confirmada_en timestamp with time zone,
          ADD COLUMN IF NOT EXISTS ubicacion_confirmada_por_id uuid
      `);
    }

    const { rows } = await client.query<FilaOrigen>(
      `SELECT id, numero_documento,
              datos_adicionales->>'${CLAVE_LAT}' AS lat,
              datos_adicionales->>'${CLAVE_LNG}' AS lng,
              datos_adicionales->>'${CLAVE_ALT}' AS alt,
              ${existenColumnas || aplicar ? 'latitud' : 'NULL::double precision'} AS latitud_actual
       FROM beneficiarios
       WHERE datos_adicionales ? '${CLAVE_LAT}' OR datos_adicionales ? '${CLAVE_LNG}'
       ORDER BY numero_documento`,
    );

    const reporte: string[] = [
      'id;documento;latitud_original;longitud_original;altitud_original;resultado;latitud;longitud;altitud;detalle',
    ];
    const conteo = { migrables: 0, pendientes: 0, yaTenian: 0 };
    const actualizaciones: Array<{
      id: string;
      latitud: number;
      longitud: number;
      altitud: number | null;
    }> = [];

    for (const fila of rows) {
      const altitud = interpretarAltitud(fila.alt);
      const base = [
        fila.id,
        fila.numero_documento,
        fila.lat,
        fila.lng,
        fila.alt,
      ].map(csv);

      if (fila.latitud_actual !== null) {
        conteo.yaTenian += 1;
        reporte.push([...base, 'ya_tenia_ubicacion', '', '', '', ''].join(';'));
        continue;
      }

      const ubicacion = interpretarUbicacion(fila.lat, fila.lng);
      if (ubicacion.ok) {
        conteo.migrables += 1;
        actualizaciones.push({
          id: fila.id,
          latitud: ubicacion.latitud,
          longitud: ubicacion.longitud,
          altitud,
        });
        reporte.push(
          [
            ...base,
            'migrada',
            ubicacion.latitud,
            ubicacion.longitud,
            altitud ?? '',
            '',
          ].join(';'),
        );
      } else {
        conteo.pendientes += 1;
        const detalle = [
          `latitud: ${ubicacion.latitud.ok ? 'ok' : ETIQUETA_MOTIVO_COORDENADA[ubicacion.latitud.motivo]}`,
          `longitud: ${ubicacion.longitud.ok ? 'ok' : ETIQUETA_MOTIVO_COORDENADA[ubicacion.longitud.motivo]}`,
        ].join(' / ');
        reporte.push(
          [...base, 'pendiente_revision', '', '', '', csv(detalle)].join(';'),
        );
      }
    }

    if (aplicar && actualizaciones.length) {
      await client.query('BEGIN');
      try {
        // Un solo UPDATE en lote: cientos de viajes contra una BD remota
        // pueden cortar la conexión a mitad de la transacción.
        const resultado = await client.query(
          `UPDATE beneficiarios b
              SET latitud = v.latitud,
                  longitud = v.longitud,
                  altitud = COALESCE(b.altitud, v.altitud),
                  ubicacion_fuente = 'EXCEL',
                  ubicacion_capturada_en = now(),
                  datos_adicionales = CASE WHEN $5::boolean
                    THEN b.datos_adicionales - $6::text - $7::text - $8::text
                    ELSE b.datos_adicionales END
             FROM unnest($1::uuid[], $2::float8[], $3::float8[], $4::float8[])
                  AS v(id, latitud, longitud, altitud)
            WHERE b.id = v.id AND b.latitud IS NULL`,
          [
            actualizaciones.map((a) => a.id),
            actualizaciones.map((a) => a.latitud),
            actualizaciones.map((a) => a.longitud),
            actualizaciones.map((a) => a.altitud),
            limpiar,
            CLAVE_LAT,
            CLAVE_LNG,
            CLAVE_ALT,
          ],
        );
        await client.query('COMMIT');
        console.log(`Filas actualizadas en BD: ${resultado.rowCount}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archivo = resolve(
      process.cwd(),
      `migracion-ubicacion-beneficiarios-${marca}.csv`,
    );
    writeFileSync(archivo, '﻿' + reporte.join('\n'), 'utf8');

    console.log(
      aplicar ? 'Modo: APLICAR' : 'Modo: solo reporte (no se escribió nada)',
    );
    console.log(`Filas con ubicación en datos adicionales: ${rows.length}`);
    console.log(`  Migrables sin ambigüedad: ${conteo.migrables}`);
    console.log(`  Pendientes de revisión:   ${conteo.pendientes}`);
    console.log(`  Ya tenían ubicación:      ${conteo.yaTenian}`);
    if (aplicar && limpiar) {
      console.log('Claves dinámicas quitadas de las filas migradas.');
    }
    console.log(`Reporte: ${archivo}`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
