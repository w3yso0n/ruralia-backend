/**
 * Pipeline completo demo de cronología.
 *
 * Crea (idempotente):
 *  - Ana Campo Demo (CAMPO)
 *  - Proyecto Demo Cronología (ACTIVO + vereda + personal)
 *  - Plan: actividad + subactividad completadas
 *  - Plantilla + envíos reales
 *  - 4 jornadas reales (estados finales) + equipo
 *  - ~15 eventos_cronologia con entidadId reales (deep-links funcionan)
 *
 * Uso: pnpm run seed:cronologia-demo
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';
import { formatearTitulo } from './formatear-titulo';
import { AccionCronologia } from './tipos-cronologia';

const CORREO = 'agente.cronologia@ruralia.demo';
const NOMBRE = 'Ana Campo Demo';
const FIREBASE_UID = 'demo-cronologia-campo';
const PROYECTO_DEMO = 'Proyecto Demo Cronología';
const DISPOSITIVO_SEED = 'seed-cronologia-demo';
const PLANTILLA_NOMBRE = 'Formulario Demo Cronología';

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

function diasAtras(dias: number, hora = 10, minuto = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

function fechaSql(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fechaTitulo(d: Date): string {
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

type EventoSeed = {
  accion: AccionCronologia;
  entidadTipo: string;
  entidadId: string | null;
  ocurridoEn: Date;
  origen: 'seed_demo' | 'sync';
  detalleExtra?: Record<string, unknown>;
  contexto: Parameters<typeof formatearTitulo>[1];
};

async function main(): Promise<void> {
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
    await client.query('BEGIN');

    const tabla = await client.query(
      `SELECT to_regclass('public.eventos_cronologia') AS nombre`,
    );
    if (!tabla.rows[0]?.nombre) {
      throw new Error(
        'No existe eventos_cronologia. Arranca el backend (synchronize) y reintenta.',
      );
    }

    const rol = await client.query(
      `SELECT id FROM roles WHERE nombre = 'CAMPO' LIMIT 1`,
    );
    if (!rol.rows[0]) {
      throw new Error('No existe el rol CAMPO.');
    }
    const rolId = rol.rows[0].id as string;

    // —— Usuario Ana ——
    let usuario = await client.query(
      `SELECT id FROM usuarios WHERE correo = $1 OR firebase_uid = $2 LIMIT 1`,
      [CORREO, FIREBASE_UID],
    );
    let actorId: string;
    if (usuario.rows[0]) {
      actorId = usuario.rows[0].id as string;
      await client.query(
        `UPDATE usuarios
         SET nombre_completo = $1, correo = $2, firebase_uid = $3, esta_activo = true
         WHERE id = $4`,
        [NOMBRE, CORREO, FIREBASE_UID, actorId],
      );
    } else {
      const creado = await client.query(
        `INSERT INTO usuarios (id, firebase_uid, correo, nombre_completo, url_foto, esta_activo, creado_en)
         VALUES (gen_random_uuid(), $1, $2, $3, NULL, true, NOW())
         RETURNING id`,
        [FIREBASE_UID, CORREO, NOMBRE],
      );
      actorId = creado.rows[0].id as string;
    }
    await client.query(
      `INSERT INTO usuario_roles (usuario_id, rol_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM usuario_roles WHERE usuario_id = $1 AND rol_id = $2
       )`,
      [actorId, rolId],
    );
    console.log(`✓ Usuario: ${NOMBRE} (${actorId})`);

    // —— Vereda ——
    const vereda = await client.query(`SELECT id FROM veredas LIMIT 1`);
    if (!vereda.rows[0]) {
      throw new Error(
        'No hay veredas. Corre pnpm run seed:territorios o crea una vereda.',
      );
    }
    const veredaId = vereda.rows[0].id as string;

    // —— Proyecto dedicado ——
    let proyecto = await client.query(
      `SELECT id, nombre FROM proyectos WHERE nombre = $1 LIMIT 1`,
      [PROYECTO_DEMO],
    );
    let proyectoId: string;
    if (proyecto.rows[0]) {
      proyectoId = proyecto.rows[0].id as string;
      await client.query(
        `UPDATE proyectos SET estado = 'ACTIVO', actualizado_en = NOW() WHERE id = $1`,
        [proyectoId],
      );
    } else {
      const insertado = await client.query(
        `INSERT INTO proyectos (
           id, nombre, descripcion, tipo, estado, fecha_inicio, fecha_fin,
           creado_en, actualizado_en, creador_id
         ) VALUES (
           gen_random_uuid(), $1, $2, 'AGRICOLA', 'ACTIVO', CURRENT_DATE, NULL,
           NOW(), NOW(), $3
         ) RETURNING id, nombre`,
        [
          PROYECTO_DEMO,
          'Pipeline demo completo para Seguimiento / cronología de agentes.',
          actorId,
        ],
      );
      proyectoId = insertado.rows[0].id as string;
      await client.query(
        `INSERT INTO proyecto_veredas (proyecto_id, vereda_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [proyectoId, veredaId],
      );
    }
    await client.query(
      `INSERT INTO proyecto_personal (proyecto_id, usuario_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM proyecto_personal WHERE proyecto_id = $1 AND usuario_id = $2
       )`,
      [proyectoId, actorId],
    );
    console.log(`✓ Proyecto: ${PROYECTO_DEMO} (${proyectoId})`);

    // —— Limpieza previa del pipeline seed ——
    const jornadasPrevias = await client.query(
      `SELECT id FROM jornadas WHERE dispositivo_id = $1`,
      [DISPOSITIVO_SEED],
    );
    const jornadaIdsPrevios = jornadasPrevias.rows.map(
      (r: { id: string }) => r.id,
    );
    if (jornadaIdsPrevios.length) {
      await client.query(
        `DELETE FROM envios_formulario WHERE jornada_id = ANY($1::uuid[])`,
        [jornadaIdsPrevios],
      );
      await client.query(
        `DELETE FROM jornada_equipo WHERE jornada_id = ANY($1::uuid[])`,
        [jornadaIdsPrevios],
      );
      await client.query(
        `DELETE FROM jornada_beneficiarios WHERE jornada_id = ANY($1::uuid[])`,
        [jornadaIdsPrevios],
      );
      await client.query(
        `DELETE FROM jornada_actividades WHERE jornada_id = ANY($1::uuid[])`,
        [jornadaIdsPrevios],
      );
      await client.query(
        `DELETE FROM jornadas WHERE id = ANY($1::uuid[])`,
        [jornadaIdsPrevios],
      );
    }

    await client.query(
      `DELETE FROM eventos_cronologia
       WHERE actor_id = $1
         AND (
           detalle->>'origen' = 'seed_demo'
           OR detalle->>'seed_demo' = 'true'
         )`,
      [actorId],
    );

    await client.query(
      `DELETE FROM subactividades
       WHERE actividad_id IN (
         SELECT id FROM actividades
         WHERE proyecto_id = $1 AND descripcion LIKE '%[seed-cronologia]%'
       )`,
      [proyectoId],
    );
    await client.query(
      `DELETE FROM actividades
       WHERE proyecto_id = $1 AND descripcion LIKE '%[seed-cronologia]%'`,
      [proyectoId],
    );

    // —— Plan: actividad hoja + actividad con sub ——
    const actDiagnostico = await client.query(
      `INSERT INTO actividades (
         id, nombre, descripcion, orden, esta_activo, estado_avance,
         nota_completado, completada_en, completada_por_id, proyecto_id
       ) VALUES (
         gen_random_uuid(),
         'Diagnóstico territorial',
         'Actividad hoja del pipeline demo [seed-cronologia]',
         1, true, 'COMPLETADA',
         'Cerrada en visita de campo',
         $1, $2, $3
       ) RETURNING id`,
      [diasAtras(6, 15, 10).toISOString(), actorId, proyectoId],
    );
    const actividadId = actDiagnostico.rows[0].id as string;

    const actVisitas = await client.query(
      `INSERT INTO actividades (
         id, nombre, descripcion, orden, esta_activo, estado_avance, proyecto_id
       ) VALUES (
         gen_random_uuid(),
         'Visitas a predios',
         'Actividad con subactividades [seed-cronologia]',
         2, true, 'PENDIENTE', $1
       ) RETURNING id`,
      [proyectoId],
    );
    const actividadVisitasId = actVisitas.rows[0].id as string;

    const subVisita = await client.query(
      `INSERT INTO subactividades (
         id, nombre, descripcion, objetivo, orden, esta_activo, estado_avance,
         nota_completado, completada_en, completada_por_id, actividad_id
       ) VALUES (
         gen_random_uuid(),
         'Visita a predio piloto',
         'Subactividad demo [seed-cronologia]',
         'Levantar línea base',
         1, true, 'COMPLETADA',
         'Predio recorrido',
         $1, $2, $3
       ) RETURNING id`,
      [diasAtras(7, 8, 0).toISOString(), actorId, actividadVisitasId],
    );
    const subactividadId = subVisita.rows[0].id as string;
    console.log(`✓ Plan: actividad ${actividadId}, sub ${subactividadId}`);

    // —— Plantilla ——
    let plantilla = await client.query(
      `SELECT id FROM plantillas_formulario WHERE nombre = $1 LIMIT 1`,
      [PLANTILLA_NOMBRE],
    );
    let plantillaId: string;
    if (plantilla.rows[0]) {
      plantillaId = plantilla.rows[0].id as string;
      await client.query(
        `UPDATE plantillas_formulario SET esta_activo = true WHERE id = $1`,
        [plantillaId],
      );
    } else {
      const creada = await client.query(
        `INSERT INTO plantillas_formulario (id, nombre, descripcion, version, esta_activo)
         VALUES (gen_random_uuid(), $1, $2, 1, true)
         RETURNING id`,
        [
          PLANTILLA_NOMBRE,
          'Plantilla mínima del pipeline de cronología [seed-cronologia]',
        ],
      );
      plantillaId = creada.rows[0].id as string;
    }
    await client.query(
      `INSERT INTO plantilla_formulario_usuarios (plantilla_formulario_id, usuario_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM plantilla_formulario_usuarios
         WHERE plantilla_formulario_id = $1 AND usuario_id = $2
       )`,
      [plantillaId, actorId],
    );

    // —— Jornadas reales ——
    const fJ1 = diasAtras(24, 8, 30);
    const fJ2 = diasAtras(14, 11, 20);
    const fJ3 = diasAtras(9, 13, 30);
    const fJ4 = diasAtras(4, 12, 0);

    async function crearJornada(opts: {
      fecha: Date;
      estado: string;
      observaciones: string;
      esOffline?: boolean;
      idLocal: string;
    }): Promise<string> {
      const row = await client.query(
        `INSERT INTO jornadas (
           id, fecha, estado, observaciones, cantidad_ejecutada,
           latitud, longitud, creado_en, es_offline, sincronizado_en,
           id_local, dispositivo_id, proyecto_id, meta_id, vereda_id,
           tecnico_responsable_id, tecnico_responsable_nombre
         ) VALUES (
           gen_random_uuid(), $1::date, $2, $3, NULL,
           4.6097, -74.0817, $4, $5, $6,
           $7, $8, $9, NULL, $10,
           $11, $12
         ) RETURNING id`,
        [
          fechaSql(opts.fecha),
          opts.estado,
          opts.observaciones,
          opts.fecha.toISOString(),
          opts.esOffline ?? false,
          opts.esOffline ? opts.fecha.toISOString() : null,
          opts.idLocal,
          DISPOSITIVO_SEED,
          proyectoId,
          veredaId,
          actorId,
          NOMBRE,
        ],
      );
      const id = row.rows[0].id as string;
      await client.query(
        `INSERT INTO jornada_equipo (jornada_id, usuario_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, actorId],
      );
      return id;
    }

    const j1 = await crearJornada({
      fecha: fJ1,
      estado: 'COMPLETADA',
      observaciones: 'Visita línea base — pipeline seed',
      idLocal: 'seed-j1',
    });
    const j2 = await crearJornada({
      fecha: fJ2,
      estado: 'CANCELADA',
      observaciones: 'Cancelada por lluvia — pipeline seed (origen sync)',
      esOffline: true,
      idLocal: 'seed-j2',
    });
    const j3 = await crearJornada({
      fecha: fJ3,
      estado: 'COMPLETADA',
      observaciones: 'Seguimiento predio piloto — pipeline seed',
      idLocal: 'seed-j3',
    });
    const j4 = await crearJornada({
      fecha: fJ4,
      estado: 'COMPLETADA',
      observaciones: 'Cierre de ciclo demo — pipeline seed',
      idLocal: 'seed-j4',
    });
    console.log(`✓ Jornadas: ${[j1, j2, j3, j4].join(', ')}`);

    // —— Envíos reales ——
    async function crearEnvio(
      jornadaId: string,
      cuando: Date,
      idLocal: string,
    ): Promise<string> {
      const row = await client.query(
        `INSERT INTO envios_formulario (
           id, enviado_en, sincronizado_en, es_offline, datos_raw,
           id_local, dispositivo_id, jornada_id, usuario_id, plantilla_formulario_id
         ) VALUES (
           gen_random_uuid(), $1, $1, false, $2::jsonb,
           $3, $4, $5, $6, $7
         ) RETURNING id`,
        [
          cuando.toISOString(),
          JSON.stringify({ seed: true, respuestas: [] }),
          idLocal,
          DISPOSITIVO_SEED,
          jornadaId,
          actorId,
          plantillaId,
        ],
      );
      return row.rows[0].id as string;
    }

    const e1 = await crearEnvio(j1, diasAtras(18, 14, 0), 'seed-e1');
    const e2 = await crearEnvio(j2, diasAtras(12, 16, 45), 'seed-e2');
    const e3 = await crearEnvio(j4, diasAtras(3, 9, 30), 'seed-e3');
    console.log(`✓ Envíos: ${[e1, e2, e3].join(', ')}`);

    // —— Eventos cronología (IDs reales) ——
    const eventos: EventoSeed[] = [
      {
        accion: 'JORNADA_CREADA',
        entidadTipo: 'jornada',
        entidadId: j1,
        ocurridoEn: diasAtras(24, 8, 30),
        origen: 'seed_demo',
        contexto: { nombreJornadaFecha: fechaTitulo(fJ1) },
      },
      {
        accion: 'JORNADA_ESTADO_CAMBIADO',
        entidadTipo: 'jornada',
        entidadId: j1,
        ocurridoEn: diasAtras(20, 9, 15),
        origen: 'seed_demo',
        contexto: {
          estadoAnterior: 'PLANIFICADA',
          estadoNuevo: 'EN_PROGRESO',
        },
        detalleExtra: {
          estadoAnterior: 'PLANIFICADA',
          estadoNuevo: 'EN_PROGRESO',
        },
      },
      {
        accion: 'FORMULARIO_ENVIADO',
        entidadTipo: 'envio_formulario',
        entidadId: e1,
        ocurridoEn: diasAtras(18, 14, 0),
        origen: 'seed_demo',
        contexto: { nombrePlantilla: PLANTILLA_NOMBRE },
        detalleExtra: { jornadaId: j1, plantillaId },
      },
      {
        accion: 'JORNADA_ESTADO_CAMBIADO',
        entidadTipo: 'jornada',
        entidadId: j1,
        ocurridoEn: diasAtras(15, 10, 0),
        origen: 'seed_demo',
        contexto: {
          estadoAnterior: 'EN_PROGRESO',
          estadoNuevo: 'COMPLETADA',
        },
        detalleExtra: {
          estadoAnterior: 'EN_PROGRESO',
          estadoNuevo: 'COMPLETADA',
        },
      },
      {
        accion: 'JORNADA_CREADA',
        entidadTipo: 'jornada',
        entidadId: j2,
        ocurridoEn: diasAtras(14, 11, 20),
        origen: 'sync',
        contexto: { nombreJornadaFecha: fechaTitulo(fJ2) },
      },
      {
        accion: 'FORMULARIO_ENVIADO',
        entidadTipo: 'envio_formulario',
        entidadId: e2,
        ocurridoEn: diasAtras(12, 16, 45),
        origen: 'seed_demo',
        contexto: { nombrePlantilla: PLANTILLA_NOMBRE },
        detalleExtra: { jornadaId: j2, plantillaId },
      },
      {
        accion: 'JORNADA_CANCELADA',
        entidadTipo: 'jornada',
        entidadId: j2,
        ocurridoEn: diasAtras(10, 9, 0),
        origen: 'seed_demo',
        contexto: { nombreJornadaFecha: fechaTitulo(fJ2) },
      },
      {
        accion: 'JORNADA_CREADA',
        entidadTipo: 'jornada',
        entidadId: j3,
        ocurridoEn: diasAtras(9, 13, 30),
        origen: 'seed_demo',
        contexto: { nombreJornadaFecha: fechaTitulo(fJ3) },
      },
      {
        accion: 'SUBACTIVIDAD_COMPLETADA',
        entidadTipo: 'subactividad',
        entidadId: subactividadId,
        ocurridoEn: diasAtras(7, 8, 0),
        origen: 'seed_demo',
        contexto: { nombreSubactividad: 'Visita a predio piloto' },
      },
      {
        accion: 'ACTIVIDAD_COMPLETADA',
        entidadTipo: 'actividad',
        entidadId: actividadId,
        ocurridoEn: diasAtras(6, 15, 10),
        origen: 'seed_demo',
        contexto: { nombreActividad: 'Diagnóstico territorial' },
      },
      {
        accion: 'JORNADA_ESTADO_CAMBIADO',
        entidadTipo: 'jornada',
        entidadId: j3,
        ocurridoEn: diasAtras(5, 10, 0),
        origen: 'seed_demo',
        contexto: {
          estadoAnterior: 'PLANIFICADA',
          estadoNuevo: 'EN_PROGRESO',
        },
        detalleExtra: {
          estadoAnterior: 'PLANIFICADA',
          estadoNuevo: 'EN_PROGRESO',
        },
      },
      {
        accion: 'JORNADA_CREADA',
        entidadTipo: 'jornada',
        entidadId: j4,
        ocurridoEn: diasAtras(4, 12, 0),
        origen: 'seed_demo',
        contexto: { nombreJornadaFecha: fechaTitulo(fJ4) },
      },
      {
        accion: 'FORMULARIO_ENVIADO',
        entidadTipo: 'envio_formulario',
        entidadId: e3,
        ocurridoEn: diasAtras(3, 9, 30),
        origen: 'seed_demo',
        contexto: { nombrePlantilla: PLANTILLA_NOMBRE },
        detalleExtra: { jornadaId: j4, plantillaId },
      },
      {
        accion: 'JORNADA_ESTADO_CAMBIADO',
        entidadTipo: 'jornada',
        entidadId: j4,
        ocurridoEn: diasAtras(2, 17, 0),
        origen: 'seed_demo',
        contexto: {
          estadoAnterior: 'EN_PROGRESO',
          estadoNuevo: 'COMPLETADA',
        },
        detalleExtra: {
          estadoAnterior: 'EN_PROGRESO',
          estadoNuevo: 'COMPLETADA',
        },
      },
      {
        accion: 'JORNADA_ESTADO_CAMBIADO',
        entidadTipo: 'jornada',
        entidadId: j3,
        ocurridoEn: diasAtras(1, 11, 15),
        origen: 'seed_demo',
        contexto: {
          estadoAnterior: 'EN_PROGRESO',
          estadoNuevo: 'COMPLETADA',
        },
        detalleExtra: {
          estadoAnterior: 'EN_PROGRESO',
          estadoNuevo: 'COMPLETADA',
        },
      },
    ];

    let insertados = 0;
    for (const ev of eventos) {
      const titulo = formatearTitulo(ev.accion, ev.contexto);
      const detalle = {
        origen: ev.origen,
        seed_demo: true,
        ...ev.detalleExtra,
      };
      await client.query(
        `INSERT INTO eventos_cronologia (
           id, actor_id, proyecto_id, accion, entidad_tipo, entidad_id,
           titulo, detalle, ocurrido_en
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::jsonb, $8
         )`,
        [
          actorId,
          proyectoId,
          ev.accion,
          ev.entidadTipo,
          ev.entidadId,
          titulo,
          JSON.stringify(detalle),
          ev.ocurridoEn.toISOString(),
        ],
      );
      insertados++;
    }

    await client.query('COMMIT');

    console.log(`✓ Eventos cronología: ${insertados}`);
    console.log('');
    console.log('Pipeline listo. En Seguimiento:');
    console.log(`  Persona → ${NOMBRE}`);
    console.log(`  Proyecto → ${PROYECTO_DEMO}`);
    console.log(
      `  Deep-link jornada → /proyectos/${proyectoId}?tab=jornadas&jornadaId=${j1}`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
