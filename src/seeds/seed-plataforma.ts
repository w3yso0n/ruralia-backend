/**
 * Seed completo de plataforma (flujo real + bandeja de Revisión RF-18/RF-19).
 *
 * Crea de forma idempotente:
 *  - Admin, Supervisor (COORDINADOR_ZONA) y Técnico (CAMPO) — con login Firebase si hay credenciales
 *  - 2 beneficiarios + veredas
 *  - Proyecto ACTIVO con personal, territorios y beneficiarios
 *  - Plan: Actividad → Subactividad → Proceso → Meta (+ periodos)
 *  - Plantillas INDIVIDUAL/GRUPAL con campos, ligadas al proceso
 *  - Jornadas de demo (todas con envío/doc/auditoría/cronología según aplique):
 *      1) EN_REVISION — reenviada tras corrección (cola supervisor)
 *      2) EN_REVISION — grupal pendiente (segunda en cola)
 *      3) RECHAZADO — rechazo OPEN (bandeja Rechazadas)
 *      4) EN_CORRECCION — técnico corrigiendo (bandeja Corrección)
 *      5) APROBADO — con approval + versión APROBADO
 *      6) SINCRONIZADO — lista para enviar a revisión (técnico)
 *      7) BORRADOR — jornada futura planificada
 *
 * Prerrequisitos:
 *  - Backend arrancado al menos una vez (schema + roles)
 *  - Preferible: pnpm run seed:territorios
 *
 * Uso: pnpm run seed:plataforma
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { normalizarClavePrivadaFirebase } from '../autenticacion/normalizar-clave-privada';

const MARCA = '[seed-plataforma]';
const DISPOSITIVO = 'seed-plataforma-s6';
const PASSWORD = 'RuraliaSeed2026!';

const PROYECTO_NOMBRE = 'Proyecto Semilla Ruralia S6';
const BENEFICIARIO_DOC = '1098765432';
const BENEFICIARIO_DOC_2 = '1098765433';

const USUARIOS = {
  admin: {
    correo: 'admin.seed@ruralia.local',
    nombre: 'Admin Semilla Ruralia',
    rol: 'ADMINISTRADOR',
    firebaseUidFallback: 'seed-plataforma-admin',
  },
  supervisor: {
    correo: 'supervisor.seed@ruralia.local',
    nombre: 'Supervisor Zona Semilla',
    rol: 'COORDINADOR_ZONA',
    firebaseUidFallback: 'seed-plataforma-supervisor',
  },
  campo: {
    correo: 'campo.seed@ruralia.local',
    nombre: 'Técnico Campo Semilla',
    rol: 'CAMPO',
    firebaseUidFallback: 'seed-plataforma-campo',
  },
} as const;

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

function diasOffset(dias: number, hora = 10, minuto = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

function fechaSql(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function initFirebase(): boolean {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? normalizarClavePrivadaFirebase(process.env.FIREBASE_PRIVATE_KEY)
    : undefined;
  if (!projectId || !clientEmail || !privateKey) return false;
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return true;
}

async function asegurarUsuarioFirebase(
  correo: string,
  nombre: string,
  fallbackUid: string,
): Promise<{ uid: string; loginReal: boolean }> {
  if (!initFirebase()) {
    return { uid: fallbackUid, loginReal: false };
  }
  const auth = getAuth();
  try {
    const existente = await auth.getUserByEmail(correo);
    await auth.updateUser(existente.uid, {
      password: PASSWORD,
      displayName: nombre,
      disabled: false,
      emailVerified: true,
    });
    return { uid: existente.uid, loginReal: true };
  } catch {
    try {
      const creado = await auth.createUser({
        email: correo,
        password: PASSWORD,
        displayName: nombre,
        emailVerified: true,
      });
      return { uid: creado.uid, loginReal: true };
    } catch (err) {
      console.warn(
        `  ⚠ Firebase no pudo crear ${correo}: ${
          err instanceof Error ? err.message : err
        }. Se usará UID local (sin login).`,
      );
      return { uid: fallbackUid, loginReal: false };
    }
  }
}

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

    // Schema mínimo
    for (const tabla of [
      'usuarios',
      'roles',
      'proyectos',
      'jornadas',
      'audit_logs',
      'documents',
      'approvals',
      'rejections',
    ]) {
      const r = await client.query(
        `SELECT to_regclass('public.${tabla}') AS n`,
      );
      if (!r.rows[0]?.n) {
        throw new Error(
          `Falta tabla ${tabla}. Arranca el backend (synchronize) y reintenta.`,
        );
      }
    }

    // —— Roles ——
    async function rolId(nombre: string): Promise<string> {
      const r = await client.query(
        `SELECT id FROM roles WHERE nombre = $1 LIMIT 1`,
        [nombre],
      );
      if (!r.rows[0]) throw new Error(`No existe rol ${nombre}. Arranca backend.`);
      return r.rows[0].id as string;
    }

    // —— Usuarios ——
    async function upsertUsuario(def: (typeof USUARIOS)[keyof typeof USUARIOS]) {
      const fb = await asegurarUsuarioFirebase(
        def.correo,
        def.nombre,
        def.firebaseUidFallback,
      );
      let row = await client.query(
        `SELECT id FROM usuarios WHERE correo = $1 OR firebase_uid = $2 LIMIT 1`,
        [def.correo, fb.uid],
      );
      let id: string;
      if (row.rows[0]) {
        id = row.rows[0].id as string;
        await client.query(
          `UPDATE usuarios
           SET nombre_completo = $1, correo = $2, firebase_uid = $3, esta_activo = true
           WHERE id = $4`,
          [def.nombre, def.correo, fb.uid, id],
        );
      } else {
        const creado = await client.query(
          `INSERT INTO usuarios (id, firebase_uid, correo, nombre_completo, url_foto, esta_activo, creado_en)
           VALUES (gen_random_uuid(), $1, $2, $3, NULL, true, NOW())
           RETURNING id`,
          [fb.uid, def.correo, def.nombre],
        );
        id = creado.rows[0].id as string;
      }
      const rid = await rolId(def.rol);
      await client.query(
        `INSERT INTO usuario_roles (usuario_id, rol_id)
         SELECT $1, $2 WHERE NOT EXISTS (
           SELECT 1 FROM usuario_roles WHERE usuario_id = $1 AND rol_id = $2
         )`,
        [id, rid],
      );
      console.log(
        `✓ Usuario ${def.rol}: ${def.nombre} <${def.correo}> ${
          fb.loginReal ? '(login Firebase OK)' : '(solo DB, sin login)'
        }`,
      );
      return { id, loginReal: fb.loginReal };
    }

    const admin = await upsertUsuario(USUARIOS.admin);
    const supervisor = await upsertUsuario(USUARIOS.supervisor);
    const campo = await upsertUsuario(USUARIOS.campo);

    // —— Veredas (preferir códigos DANE conocidos; fallback cualquier) ——
    const codigosPreferidos = ['25001009', '11001051', '05895011', '94001003'];
    const veredas: string[] = [];
    for (const codigo of codigosPreferidos) {
      const v = await client.query(
        `SELECT id, nombre FROM veredas WHERE codigo = $1 LIMIT 1`,
        [codigo],
      );
      if (v.rows[0]) veredas.push(v.rows[0].id as string);
    }
    if (veredas.length < 2) {
      const extras = await client.query(
        `SELECT id FROM veredas WHERE id != ALL($1::uuid[]) LIMIT $2`,
        [veredas.length ? veredas : ['00000000-0000-0000-0000-000000000000'], 2],
      );
      for (const r of extras.rows) veredas.push(r.id as string);
    }
    if (!veredas.length) {
      throw new Error(
        'No hay veredas. Corre: pnpm run seed:territorios',
      );
    }
    const veredaA = veredas[0];
    const veredaB = veredas[1] ?? veredas[0];
    console.log(`✓ Veredas: ${veredaA}, ${veredaB}`);

    // —— Beneficiarios ——
    async function upsertBeneficiario(opts: {
      doc: string;
      nombres: string;
      apellidos: string;
      telefono: string;
      correo: string;
      genero: string;
      fechaNac: string;
      veredaId: string;
    }): Promise<string> {
      const existente = await client.query(
        `SELECT id FROM beneficiarios WHERE numero_documento = $1 LIMIT 1`,
        [opts.doc],
      );
      if (existente.rows[0]) {
        const id = existente.rows[0].id as string;
        await client.query(
          `UPDATE beneficiarios
           SET nombres = $1, apellidos = $2, vereda_id = $3, esta_activo = true,
               telefono = $4, correo = $5, genero = $6
           WHERE id = $7`,
          [
            opts.nombres,
            opts.apellidos,
            opts.veredaId,
            opts.telefono,
            opts.correo,
            opts.genero,
            id,
          ],
        );
        return id;
      }
      const b = await client.query(
        `INSERT INTO beneficiarios (
           id, nombres, apellidos, tipo_documento, numero_documento,
           telefono, correo, genero, fecha_nacimiento, esta_activo, creado_en, vereda_id
         ) VALUES (
           gen_random_uuid(), $1, $2, 'CC', $3,
           $4, $5, $6, $7, true, NOW(), $8
         ) RETURNING id`,
        [
          opts.nombres,
          opts.apellidos,
          opts.doc,
          opts.telefono,
          opts.correo,
          opts.genero,
          opts.fechaNac,
          opts.veredaId,
        ],
      );
      return b.rows[0].id as string;
    }

    const beneficiarioId = await upsertBeneficiario({
      doc: BENEFICIARIO_DOC,
      nombres: 'María',
      apellidos: 'Pérez Gómez',
      telefono: '3001234567',
      correo: 'maria.perez@ruralia.demo',
      genero: 'FEMENINO',
      fechaNac: '1985-04-12',
      veredaId: veredaA,
    });
    const beneficiario2Id = await upsertBeneficiario({
      doc: BENEFICIARIO_DOC_2,
      nombres: 'Pedro',
      apellidos: 'Ramírez Vargas',
      telefono: '3009876543',
      correo: 'pedro.ramirez@ruralia.demo',
      genero: 'MASCULINO',
      fechaNac: '1978-09-03',
      veredaId: veredaB,
    });
    console.log(
      `✓ Beneficiarios: María Pérez Gómez (${beneficiarioId}), Pedro Ramírez Vargas (${beneficiario2Id})`,
    );

    // —— Proyecto ——
    let proy = await client.query(
      `SELECT id FROM proyectos WHERE nombre = $1 LIMIT 1`,
      [PROYECTO_NOMBRE],
    );
    let proyectoId: string;
    const fechaInicio = fechaSql(diasOffset(-90));
    const fechaFin = fechaSql(diasOffset(180));
    if (proy.rows[0]) {
      proyectoId = proy.rows[0].id as string;
      await client.query(
        `UPDATE proyectos SET
           estado = 'ACTIVO', tipo = 'AGRICOLA',
           descripcion = $1, fecha_inicio = $2::date, fecha_fin = $3::date,
           actualizado_en = NOW(), creador_id = $4
         WHERE id = $5`,
        [
          `Proyecto sembrado para flujo completo de plataforma ${MARCA}`,
          fechaInicio,
          fechaFin,
          admin.id,
          proyectoId,
        ],
      );
    } else {
      const p = await client.query(
        `INSERT INTO proyectos (
           id, nombre, descripcion, tipo, estado, fecha_inicio, fecha_fin,
           creado_en, actualizado_en, creador_id
         ) VALUES (
           gen_random_uuid(), $1, $2, 'AGRICOLA', 'ACTIVO', $3::date, $4::date,
           NOW(), NOW(), $5
         ) RETURNING id`,
        [
          PROYECTO_NOMBRE,
          `Proyecto sembrado para flujo completo de plataforma ${MARCA}`,
          fechaInicio,
          fechaFin,
          admin.id,
        ],
      );
      proyectoId = p.rows[0].id as string;
    }

    for (const uid of [admin.id, supervisor.id, campo.id]) {
      await client.query(
        `INSERT INTO proyecto_personal (proyecto_id, usuario_id)
         SELECT $1, $2 WHERE NOT EXISTS (
           SELECT 1 FROM proyecto_personal WHERE proyecto_id = $1 AND usuario_id = $2
         )`,
        [proyectoId, uid],
      );
    }
    for (const vid of [veredaA, veredaB]) {
      await client.query(
        `INSERT INTO proyecto_veredas (proyecto_id, vereda_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [proyectoId, vid],
      );
    }
    for (const [bid, principal] of [
      [beneficiarioId, true],
      [beneficiario2Id, false],
    ] as const) {
      await client.query(
        `INSERT INTO proyecto_beneficiarios (id, proyecto_id, beneficiario_id, es_principal)
         SELECT gen_random_uuid(), $1, $2, $3
         WHERE NOT EXISTS (
           SELECT 1 FROM proyecto_beneficiarios
           WHERE proyecto_id = $1 AND beneficiario_id = $2
         )`,
        [proyectoId, bid, principal],
      );
    }
    console.log(`✓ Proyecto: ${PROYECTO_NOMBRE} (${proyectoId})`);

    // —— Limpieza previa del seed ——
    const jornadasPrev = await client.query(
      `SELECT id FROM jornadas WHERE dispositivo_id = $1`,
      [DISPOSITIVO],
    );
    const jIds = jornadasPrev.rows.map((r: { id: string }) => r.id);
    if (jIds.length) {
      await client.query(
        `DELETE FROM respuestas_formulario WHERE envio_formulario_id IN (
           SELECT id FROM envios_formulario WHERE jornada_id = ANY($1::uuid[])
         )`,
        [jIds],
      );
      await client.query(
        `DELETE FROM envios_formulario WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `DELETE FROM evidencias WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `DELETE FROM jornada_asistentes WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `DELETE FROM jornada_equipo WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `DELETE FROM jornada_beneficiarios WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `DELETE FROM jornada_actividades WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );

      // Documentos / RF-18-19 ligados a estas jornadas
      await client.query(
        `DELETE FROM approvals WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `DELETE FROM rejections WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `DELETE FROM audit_logs WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `UPDATE documents SET version_vigente_id = NULL
         WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `DELETE FROM document_versions WHERE document_id IN (
           SELECT id FROM documents WHERE jornada_id = ANY($1::uuid[])
         )`,
        [jIds],
      );
      await client.query(
        `DELETE FROM documents WHERE jornada_id = ANY($1::uuid[])`,
        [jIds],
      );
      await client.query(
        `DELETE FROM eventos_cronologia WHERE entidad_id = ANY($1::uuid[])
           OR (detalle->>'seed_plataforma' = 'true')`,
        [jIds],
      );
      await client.query(`DELETE FROM jornadas WHERE id = ANY($1::uuid[])`, [
        jIds,
      ]);
    }

    // Limpiar plan anterior del seed
    await client.query(
      `DELETE FROM meta_periodos WHERE meta_id IN (
         SELECT m.id FROM metas m
         JOIN procesos p ON p.id = m.proceso_id
         JOIN subactividades s ON s.id = p.subactividad_id
         JOIN actividades a ON a.id = s.actividad_id
         WHERE a.proyecto_id = $1 AND a.descripcion LIKE $2
       )`,
      [proyectoId, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM plantilla_formulario_procesos WHERE proceso_id IN (
         SELECT p.id FROM procesos p
         JOIN subactividades s ON s.id = p.subactividad_id
         JOIN actividades a ON a.id = s.actividad_id
         WHERE a.proyecto_id = $1 AND a.descripcion LIKE $2
       )`,
      [proyectoId, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM metas WHERE proceso_id IN (
         SELECT p.id FROM procesos p
         JOIN subactividades s ON s.id = p.subactividad_id
         JOIN actividades a ON a.id = s.actividad_id
         WHERE a.proyecto_id = $1 AND a.descripcion LIKE $2
       )`,
      [proyectoId, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM procesos WHERE subactividad_id IN (
         SELECT s.id FROM subactividades s
         JOIN actividades a ON a.id = s.actividad_id
         WHERE a.proyecto_id = $1 AND a.descripcion LIKE $2
       )`,
      [proyectoId, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM subactividades WHERE actividad_id IN (
         SELECT id FROM actividades WHERE proyecto_id = $1 AND descripcion LIKE $2
       )`,
      [proyectoId, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM actividades WHERE proyecto_id = $1 AND descripcion LIKE $2`,
      [proyectoId, `%${MARCA}%`],
    );

    // —— Plan completo ——
    const act = await client.query(
      `INSERT INTO actividades (
         id, nombre, descripcion, orden, esta_activo, estado_avance, proyecto_id
       ) VALUES (
         gen_random_uuid(),
         'Fortalecimiento productivo',
         'Actividad principal del plan ${MARCA}',
         1, true, 'PENDIENTE', $1
       ) RETURNING id`,
      [proyectoId],
    );
    const actividadId = act.rows[0].id as string;

    const sub = await client.query(
      `INSERT INTO subactividades (
         id, nombre, descripcion, objetivo, orden, esta_activo, estado_avance, actividad_id
       ) VALUES (
         gen_random_uuid(),
         'Asistencia técnica predial',
         'Subactividad de campo ${MARCA}',
         'Acompañar a beneficiarios en buenas prácticas',
         1, true, 'PENDIENTE', $1
       ) RETURNING id`,
      [actividadId],
    );
    const subactividadId = sub.rows[0].id as string;

    const proc = await client.query(
      `INSERT INTO procesos (
         id, nombre, descripcion, orden, esta_activo, subactividad_id
       ) VALUES (
         gen_random_uuid(),
         'Visita de asistencia técnica',
         'Proceso operativo ${MARCA}',
         1, true, $1
       ) RETURNING id`,
      [subactividadId],
    );
    const procesoId = proc.rows[0].id as string;

    const meta = await client.query(
      `INSERT INTO metas (
         id, nombre, unidad_medida, cantidad_total, orden, esta_activo, proceso_id
       ) VALUES (
         gen_random_uuid(),
         'Predios acompañados',
         'predios',
         40,
         1, true, $1
       ) RETURNING id`,
      [procesoId],
    );
    const metaId = meta.rows[0].id as string;

    const anio = new Date().getFullYear();
    const mes = new Date().getMonth() + 1;
    const mes2 = mes === 12 ? 1 : mes + 1;
    const anio2 = mes === 12 ? anio + 1 : anio;
    for (const [a, m, cant] of [
      [anio, mes, 10],
      [anio2, mes2, 10],
    ] as const) {
      await client.query(
        `INSERT INTO meta_periodos (id, meta_id, anio, mes, cantidad_planeada)
         SELECT gen_random_uuid(), $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM meta_periodos WHERE meta_id = $1 AND anio = $2 AND mes = $3
         )`,
        [metaId, a, m, cant],
      );
    }
    console.log(
      `✓ Plan: actividad → sub → proceso → meta (${metaId})`,
    );

    // —— Plantillas ——
    async function upsertPlantilla(
      nombre: string,
      tipo: 'INDIVIDUAL' | 'GRUPAL',
    ): Promise<{ id: string; campos: Record<string, string> }> {
      let p = await client.query(
        `SELECT id FROM plantillas_formulario WHERE nombre = $1 LIMIT 1`,
        [nombre],
      );
      let plantillaId: string;
      if (p.rows[0]) {
        plantillaId = p.rows[0].id as string;
        await client.query(
          `UPDATE plantillas_formulario
           SET esta_activo = true, tipo_plantilla = $1, version = version + 1
           WHERE id = $2`,
          [tipo, plantillaId],
        );
        await client.query(
          `DELETE FROM campos_formulario WHERE plantilla_formulario_id = $1`,
          [plantillaId],
        );
      } else {
        const creada = await client.query(
          `INSERT INTO plantillas_formulario (
             id, nombre, descripcion, version, esta_activo, tipo_plantilla
           ) VALUES (
             gen_random_uuid(), $1, $2, 1, true, $3
           ) RETURNING id`,
          [nombre, `Plantilla ${tipo} ${MARCA}`, tipo],
        );
        plantillaId = creada.rows[0].id as string;
      }

      const camposDef =
        tipo === 'INDIVIDUAL'
          ? [
              {
                etiqueta: 'Observaciones de la visita',
                clave: 'observaciones',
                tipoCampo: 'TEXTO',
                orden: 1,
                obligatorio: true,
              },
              {
                etiqueta: 'Número de predios visitados',
                clave: 'predios_visitados',
                tipoCampo: 'NUMERO',
                orden: 2,
                obligatorio: true,
              },
              {
                etiqueta: '¿Se entregó material?',
                clave: 'entrego_material',
                tipoCampo: 'SI_NO',
                orden: 3,
                obligatorio: true,
              },
              {
                etiqueta: 'Firma del beneficiario',
                clave: 'firma_beneficiario',
                tipoCampo: 'FIRMA',
                orden: 4,
                obligatorio: false,
              },
            ]
          : [
              {
                etiqueta: 'Tema de la jornada grupal',
                clave: 'tema',
                tipoCampo: 'TEXTO',
                orden: 1,
                obligatorio: true,
              },
              {
                etiqueta: 'Lista de asistencia',
                clave: 'asistencia',
                tipoCampo: 'TABLA',
                orden: 2,
                obligatorio: true,
                opciones: {
                  columnas: [
                    { clave: 'nombre', etiqueta: 'Nombre' },
                    { clave: 'documento', etiqueta: 'Documento' },
                    { clave: 'firma', etiqueta: 'Firma' },
                  ],
                },
              },
            ];

      const campos: Record<string, string> = {};
      for (const c of camposDef) {
        const row = await client.query(
          `INSERT INTO campos_formulario (
             id, etiqueta, clave, tipo_campo, opciones, es_obligatorio, orden,
             reglas_validacion, plantilla_formulario_id
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4::jsonb, $5, $6, NULL, $7
           ) RETURNING id`,
          [
            c.etiqueta,
            c.clave,
            c.tipoCampo,
            c.opciones ? JSON.stringify(c.opciones) : null,
            c.obligatorio,
            c.orden,
            plantillaId,
          ],
        );
        campos[c.clave] = row.rows[0].id as string;
      }

      await client.query(
        `INSERT INTO plantilla_formulario_procesos (plantilla_formulario_id, proceso_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [plantillaId, procesoId],
      );
      for (const uid of [campo.id, supervisor.id]) {
        await client.query(
          `INSERT INTO plantilla_formulario_usuarios (plantilla_formulario_id, usuario_id)
           SELECT $1, $2 WHERE NOT EXISTS (
             SELECT 1 FROM plantilla_formulario_usuarios
             WHERE plantilla_formulario_id = $1 AND usuario_id = $2
           )`,
          [plantillaId, uid],
        );
      }
      return { id: plantillaId, campos };
    }

    const plantillaInd = await upsertPlantilla(
      'Formulario visita individual S6',
      'INDIVIDUAL',
    );
    const plantillaGrupal = await upsertPlantilla(
      'Acta asistencia grupal S6',
      'GRUPAL',
    );
    console.log(
      `✓ Plantillas: individual ${plantillaInd.id}, grupal ${plantillaGrupal.id}`,
    );

    // —— Helper: jornada completa (envío + doc + versiones + auditoría) ——
    type CampoSnap = {
      clave: string;
      etiqueta: string;
      tipo: string;
      valor: unknown;
    };
    type VersionDef = {
      versionNumber: number;
      status: 'GENERADO' | 'CORREGIDO' | 'APROBADO' | 'RECHAZADO';
      when: Date;
      changeReason: string | null;
      campos: CampoSnap[];
    };
    type RespuestaSeed = {
      clave: string;
      texto?: string | null;
      numero?: number | null;
      bool?: boolean | null;
      json?: unknown;
    };
    type AuditSeed = {
      action: string;
      field: string | null;
      prev: unknown;
      next: unknown;
      reason: string;
      userId: string;
      role: string;
      when: Date;
      versionNumber?: number;
    };
    type CronoSeed = {
      accion: string;
      actor: string;
      when: Date;
      titulo: string;
    };
    type RechazoSeed = {
      category: string;
      reason: string;
      requestedCorrection: string;
      status: 'OPEN' | 'RESOLVED';
      when: Date;
      resolvedAt?: Date;
      resolvedBy?: string;
      resolutionVersionNumber?: number;
    };

    async function crearJornadaFlujo(opts: {
      idLocal: string;
      nombre: string;
      observaciones: string;
      fecha: Date;
      estado: string;
      estadoFuncional: string;
      tipo: 'INDIVIDUAL' | 'GRUPAL';
      veredaId: string;
      beneficiarioIds: string[];
      plantilla: { id: string; campos: Record<string, string> };
      cantidadEjecutada?: number | null;
      lat?: number | null;
      lng?: number | null;
      sincronizado?: boolean;
      respuestas?: RespuestaSeed[];
      conDocumento?: boolean;
      docTitulo?: string;
      docEstadoFuncional?: string;
      versiones?: VersionDef[];
      rechazo?: RechazoSeed;
      aprobacion?: { when: Date; notes: string };
      evidencia?: {
        tipo: string;
        nombreArchivo: string;
        estadoFuncional: string;
        when: Date;
      };
      audits?: AuditSeed[];
      cronos?: CronoSeed[];
    }): Promise<{ jornadaId: string; documentoId: string | null }> {
      const j = await client.query(
        `INSERT INTO jornadas (
           id, fecha, estado, estado_funcional, tipo, nombre, observaciones,
           cantidad_ejecutada, latitud, longitud, creado_en,
           es_offline, sincronizado_en, id_local, dispositivo_id,
           proyecto_id, meta_id, vereda_id,
           tecnico_responsable_id, tecnico_responsable_nombre, grupo_jornada_id
         ) VALUES (
           gen_random_uuid(), $1::date, $2, $3, $4, $5, $6,
           $7, $8, $9, $10::timestamptz,
           false, $11::timestamptz, $12, $13,
           $14::uuid, $15::uuid, $16::uuid, $17::uuid, $18, NULL
         ) RETURNING id`,
        [
          fechaSql(opts.fecha),
          opts.estado,
          opts.estadoFuncional,
          opts.tipo,
          opts.nombre,
          opts.observaciones,
          opts.cantidadEjecutada ?? null,
          opts.lat ?? null,
          opts.lng ?? null,
          opts.fecha.toISOString(),
          opts.sincronizado === false ? null : opts.fecha.toISOString(),
          opts.idLocal,
          DISPOSITIVO,
          proyectoId,
          metaId,
          opts.veredaId,
          campo.id,
          USUARIOS.campo.nombre,
        ],
      );
      const jornadaId = j.rows[0].id as string;

      await client.query(
        `INSERT INTO jornada_equipo (jornada_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [jornadaId, campo.id],
      );
      for (const bid of opts.beneficiarioIds) {
        await client.query(
          `INSERT INTO jornada_beneficiarios (jornada_id, beneficiario_id)
           SELECT $1, $2 WHERE NOT EXISTS (
             SELECT 1 FROM jornada_beneficiarios WHERE jornada_id = $1 AND beneficiario_id = $2
           )`,
          [jornadaId, bid],
        );
      }

      let envioId: string | null = null;
      if (opts.respuestas && opts.respuestas.length) {
        const envio = await client.query(
          `INSERT INTO envios_formulario (
             id, enviado_en, sincronizado_en, es_offline, datos_raw,
             id_local, dispositivo_id, indice_fila, jornada_id, usuario_id, plantilla_formulario_id
           ) VALUES (
             gen_random_uuid(), $1, $1, false, $2::jsonb,
             $3, $4, 0, $5, $6, $7
           ) RETURNING id`,
          [
            diasOffset(
              Math.round(
                (opts.fecha.getTime() - Date.now()) / 86400000,
              ) + 1,
              16,
              0,
            ).toISOString(),
            JSON.stringify({ seed: true, marca: MARCA, idLocal: opts.idLocal }),
            `envio-${opts.idLocal}`,
            DISPOSITIVO,
            jornadaId,
            campo.id,
            opts.plantilla.id,
          ],
        );
        envioId = envio.rows[0].id as string;

        for (const r of opts.respuestas) {
          const campoId = opts.plantilla.campos[r.clave];
          if (!campoId) continue;
          await client.query(
            `INSERT INTO respuestas_formulario (
               id, clave_campo, valor_texto, valor_numero, valor_fecha, valor_booleano,
               valor_json, url_archivo, envio_formulario_id, campo_formulario_id
             ) VALUES (
               gen_random_uuid(), $1, $2, $3, NULL, $4, $5::jsonb, NULL, $6, $7
             )`,
            [
              r.clave,
              r.texto ?? null,
              r.numero ?? null,
              r.bool ?? null,
              r.json != null ? JSON.stringify(r.json) : null,
              envioId,
              campoId,
            ],
          );
        }
      }

      if (opts.evidencia) {
        await client.query(
          `INSERT INTO evidencias (
             id, tipo, estado, estado_funcional, url_archivo, url_miniatura,
             nombre_archivo, tamano_archivo, tipo_mime, capturado_en,
             latitud, longitud, es_offline, sincronizado_en, id_local, dispositivo_id, jornada_id
           ) VALUES (
             gen_random_uuid(), $1, 'SINCRONIZADA', $2,
             'https://placehold.co/800x600/jpg?text=Evidencia+Seed',
             'https://placehold.co/200x150/jpg?text=Thumb',
             $3, 245760, 'image/jpeg', $4::timestamptz,
             $5, $6, false, $4::timestamptz, $7, $8, $9
           )`,
          [
            opts.evidencia.tipo,
            opts.evidencia.estadoFuncional,
            opts.evidencia.nombreArchivo,
            opts.evidencia.when.toISOString(),
            opts.lat ?? 4.6097,
            opts.lng ?? -74.0817,
            `ev-${opts.idLocal}`,
            DISPOSITIVO,
            jornadaId,
          ],
        );
      }

      let documentoId: string | null = null;
      const versionIds = new Map<number, string>();

      if (opts.conDocumento !== false && opts.versiones && opts.versiones.length) {
        const doc = await client.query(
          `INSERT INTO documents (
             id, proyecto_id, jornada_id, tipo, titulo, plantilla_id,
             version_vigente_id, estado_funcional, creado_en
           ) VALUES (
             gen_random_uuid(), $1, $2, 'REPORTE_FORMULARIO',
             $3, $4, NULL, $5, NOW()
           ) RETURNING id`,
          [
            proyectoId,
            jornadaId,
            opts.docTitulo ?? `Reporte — ${opts.nombre}`,
            opts.plantilla.id,
            opts.docEstadoFuncional ?? opts.estadoFuncional,
          ],
        );
        documentoId = doc.rows[0].id as string;

        let prevVersionId: string | null = null;
        const ordenadas = [...opts.versiones].sort(
          (a, b) => a.versionNumber - b.versionNumber,
        );
        for (const v of ordenadas) {
          const ver = await client.query(
            `INSERT INTO document_versions (
               id, document_id, version_number, status, generated_from_jornada_id,
               template_id, created_by, created_at, change_reason, file_path,
               previous_version_id, snapshot
             ) VALUES (
               gen_random_uuid(), $1, $2, $3, $4,
               $5, $6, $7, $8, NULL, $9, $10::jsonb
             ) RETURNING id`,
            [
              documentoId,
              v.versionNumber,
              v.status,
              jornadaId,
              opts.plantilla.id,
              campo.id,
              v.when.toISOString(),
              v.changeReason,
              prevVersionId,
              JSON.stringify({
                versionNumber: v.versionNumber,
                tecnico: USUARIOS.campo.nombre,
                campos: v.campos,
              }),
            ],
          );
          const vid = ver.rows[0].id as string;
          versionIds.set(v.versionNumber, vid);
          prevVersionId = vid;
        }
        const ultima = ordenadas[ordenadas.length - 1];
        await client.query(
          `UPDATE documents SET version_vigente_id = $1 WHERE id = $2`,
          [versionIds.get(ultima.versionNumber), documentoId],
        );
      }

      if (opts.rechazo && documentoId) {
        await client.query(
          `INSERT INTO rejections (
             id, entity_type, entity_id, project_id, jornada_id, document_id,
             evidence_id, rejected_by, rejected_at, category, reason,
             requested_correction, status, resolved_at, resolved_by, resolution_version_id
           ) VALUES (
             gen_random_uuid(), 'JORNADA', $1, $2, $1, $3,
             NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12
           )`,
          [
            jornadaId,
            proyectoId,
            documentoId,
            supervisor.id,
            opts.rechazo.when.toISOString(),
            opts.rechazo.category,
            opts.rechazo.reason,
            opts.rechazo.requestedCorrection,
            opts.rechazo.status,
            opts.rechazo.resolvedAt?.toISOString() ?? null,
            opts.rechazo.resolvedBy ?? null,
            opts.rechazo.resolutionVersionNumber != null
              ? versionIds.get(opts.rechazo.resolutionVersionNumber) ?? null
              : null,
          ],
        );
      }

      if (opts.aprobacion && documentoId) {
        const vigente =
          versionIds.get(
            Math.max(...[...versionIds.keys()]),
          ) ?? null;
        await client.query(
          `INSERT INTO approvals (
             id, entity_type, entity_id, project_id, jornada_id, document_id,
             document_version_id, approved_by, approved_at, notes
           ) VALUES (
             gen_random_uuid(), 'JORNADA', $1, $2, $1, $3,
             $4, $5, $6, $7
           )`,
          [
            jornadaId,
            proyectoId,
            documentoId,
            vigente,
            supervisor.id,
            opts.aprobacion.when.toISOString(),
            opts.aprobacion.notes,
          ],
        );
      }

      for (const a of opts.audits ?? []) {
        await client.query(
          `INSERT INTO audit_logs (
             id, entity_type, entity_id, field, previous_value, new_value, reason,
             action, user_id, user_role, created_at, project_id, jornada_id,
             document_id, document_version_id, device_id, source
           ) VALUES (
             gen_random_uuid(), 'JORNADA', $1, $2, $3::jsonb, $4::jsonb, $5,
             $6, $7, $8, $9, $10, $1, $11, $12, $13, 'seed'
           )`,
          [
            jornadaId,
            a.field,
            JSON.stringify(a.prev),
            JSON.stringify(a.next),
            a.reason,
            a.action,
            a.userId,
            a.role,
            a.when.toISOString(),
            proyectoId,
            documentoId,
            a.versionNumber != null
              ? versionIds.get(a.versionNumber) ?? null
              : null,
            DISPOSITIVO,
          ],
        );
      }

      for (const c of opts.cronos ?? []) {
        await client.query(
          `INSERT INTO eventos_cronologia (
             id, actor_id, proyecto_id, accion, entidad_tipo, entidad_id,
             titulo, detalle, ocurrido_en
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, 'jornada', $4, $5, $6::jsonb, $7
           )`,
          [
            c.actor,
            proyectoId,
            c.accion,
            jornadaId,
            c.titulo,
            JSON.stringify({
              origen: 'seed_demo',
              seed_plataforma: true,
              marca: MARCA,
              idLocal: opts.idLocal,
            }),
            c.when.toISOString(),
          ],
        );
      }

      return { jornadaId, documentoId };
    }

    const camposIndBase = (
      obs: string,
      predios: number,
      material: boolean,
    ): CampoSnap[] => [
      {
        clave: 'observaciones',
        etiqueta: 'Observaciones de la visita',
        tipo: 'TEXTO',
        valor: obs,
      },
      {
        clave: 'predios_visitados',
        etiqueta: 'Número de predios visitados',
        tipo: 'NUMERO',
        valor: predios,
      },
      {
        clave: 'entrego_material',
        etiqueta: '¿Se entregó material?',
        tipo: 'SI_NO',
        valor: material,
      },
    ];

    // 1) EN_REVISION — historial rechazo resuelto + reenvío (cola supervisor)
    const j1 = await crearJornadaFlujo({
      idLocal: 'seed-j-en-revision',
      nombre: 'Visita predio María Pérez',
      observaciones: `Visita completada y reenviada a revisión ${MARCA}`,
      fecha: diasOffset(-5, 9, 0),
      estado: 'COMPLETADA',
      estadoFuncional: 'EN_REVISION',
      tipo: 'INDIVIDUAL',
      veredaId: veredaA,
      beneficiarioIds: [beneficiarioId],
      plantilla: plantillaInd,
      cantidadEjecutada: 2,
      lat: 4.6097,
      lng: -74.0817,
      respuestas: [
        {
          clave: 'observaciones',
          texto:
            'Se revisó sistema de riego y se entregó cartilla de buenas prácticas.',
        },
        { clave: 'predios_visitados', numero: 2 },
        { clave: 'entrego_material', bool: true },
      ],
      docTitulo: 'Reporte de formulario — Visita predio María Pérez',
      docEstadoFuncional: 'EN_REVISION',
      versiones: [
        {
          versionNumber: 1,
          status: 'GENERADO',
          when: diasOffset(-3, 11, 0),
          changeReason: 'Primera generación al enviar a revisión',
          campos: camposIndBase(
            'Se revisó sistema de riego. Pendiente confirmar entrega de material.',
            1,
            false,
          ),
        },
        {
          versionNumber: 2,
          status: 'CORREGIDO',
          when: diasOffset(-1, 15, 30),
          changeReason:
            'Se completó el número de predios y la evidencia de material',
          campos: camposIndBase(
            'Se revisó sistema de riego y se entregó cartilla de buenas prácticas.',
            2,
            true,
          ),
        },
      ],
      evidencia: {
        tipo: 'FOTO',
        nombreArchivo: 'riego-maria.jpg',
        estadoFuncional: 'EN_REVISION',
        when: diasOffset(-4, 15, 0),
      },
      rechazo: {
        category: 'INFORMACION_INCOMPLETA',
        reason: 'Faltaba detalle de predios visitados',
        requestedCorrection:
          'Completar el número de predios y confirmar entrega de material',
        status: 'RESOLVED',
        when: diasOffset(-2, 10, 0),
        resolvedAt: diasOffset(-1, 15, 0),
        resolvedBy: campo.id,
        resolutionVersionNumber: 2,
      },
      audits: [
        {
          action: 'SUBMIT_FOR_REVIEW',
          field: 'estadoFuncional',
          prev: 'SINCRONIZADO',
          next: 'EN_REVISION',
          reason: 'Envío inicial a revisión',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-3, 11, 0),
          versionNumber: 1,
        },
        {
          action: 'REJECT',
          field: 'estadoFuncional',
          prev: 'EN_REVISION',
          next: 'RECHAZADO',
          reason: 'Faltaba detalle de predios visitados',
          userId: supervisor.id,
          role: 'COORDINADOR_ZONA',
          when: diasOffset(-2, 10, 0),
          versionNumber: 1,
        },
        {
          action: 'UPDATE',
          field: 'predios_visitados',
          prev: 1,
          next: 2,
          reason: 'Corrección solicitada por supervisor',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-1, 14, 0),
          versionNumber: 2,
        },
        {
          action: 'CREATE_VERSION',
          field: null,
          prev: { versionNumber: 1 },
          next: { versionNumber: 2 },
          reason: 'Se completó el número de predios y la evidencia de material',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-1, 15, 30),
          versionNumber: 2,
        },
        {
          action: 'RESUBMIT',
          field: 'estadoFuncional',
          prev: 'EN_CORRECCION',
          next: 'EN_REVISION',
          reason: 'Reenvío tras corrección',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-1, 15, 45),
          versionNumber: 2,
        },
      ],
      cronos: [
        {
          accion: 'JORNADA_CREADA',
          actor: campo.id,
          when: diasOffset(-5, 9, 0),
          titulo: 'Creó jornada de visita predial',
        },
        {
          accion: 'FORMULARIO_ENVIADO',
          actor: campo.id,
          when: diasOffset(-4, 16, 0),
          titulo: 'Envió formulario «Formulario visita individual S6»',
        },
        {
          accion: 'JORNADA_ENVIADA_REVISION',
          actor: campo.id,
          when: diasOffset(-3, 11, 0),
          titulo: 'Envió jornada a revisión',
        },
        {
          accion: 'JORNADA_RECHAZADA',
          actor: supervisor.id,
          when: diasOffset(-2, 10, 0),
          titulo: 'Rechazó la jornada',
        },
        {
          accion: 'JORNADA_REENVIADA_REVISION',
          actor: campo.id,
          when: diasOffset(-1, 15, 45),
          titulo: 'Reenvió jornada a revisión',
        },
      ],
    });
    console.log(`✓ EN_REVISION (reenviada): ${j1.jornadaId}`);

    // 2) EN_REVISION — grupal pendiente (segunda en cola)
    const j2 = await crearJornadaFlujo({
      idLocal: 'seed-j-grupal-revision',
      nombre: 'Taller grupal buenas prácticas',
      observaciones: `Jornada grupal enviada a revisión ${MARCA}`,
      fecha: diasOffset(-2, 8, 0),
      estado: 'COMPLETADA',
      estadoFuncional: 'EN_REVISION',
      tipo: 'GRUPAL',
      veredaId: veredaB,
      beneficiarioIds: [beneficiarioId, beneficiario2Id],
      plantilla: plantillaGrupal,
      cantidadEjecutada: 8,
      lat: 4.65,
      lng: -74.1,
      respuestas: [
        {
          clave: 'tema',
          texto: 'Buenas prácticas de riego y compostaje',
        },
        {
          clave: 'asistencia',
          json: {
            filas: [
              {
                nombre: 'María Pérez Gómez',
                documento: BENEFICIARIO_DOC,
                firma: true,
              },
              {
                nombre: 'Pedro Ramírez Vargas',
                documento: BENEFICIARIO_DOC_2,
                firma: true,
              },
            ],
          },
        },
      ],
      docTitulo: 'Acta grupal — Taller buenas prácticas',
      docEstadoFuncional: 'EN_REVISION',
      versiones: [
        {
          versionNumber: 1,
          status: 'GENERADO',
          when: diasOffset(-1, 18, 0),
          changeReason: 'Envío a revisión del acta grupal',
          campos: [
            {
              clave: 'tema',
              etiqueta: 'Tema de la jornada grupal',
              tipo: 'TEXTO',
              valor: 'Buenas prácticas de riego y compostaje',
            },
            {
              clave: 'asistencia',
              etiqueta: 'Lista de asistencia',
              tipo: 'TABLA',
              valor: {
                filas: [
                  {
                    nombre: 'María Pérez Gómez',
                    documento: BENEFICIARIO_DOC,
                    firma: true,
                  },
                  {
                    nombre: 'Pedro Ramírez Vargas',
                    documento: BENEFICIARIO_DOC_2,
                    firma: true,
                  },
                ],
              },
            },
          ],
        },
      ],
      evidencia: {
        tipo: 'FOTO',
        nombreArchivo: 'taller-grupal.jpg',
        estadoFuncional: 'EN_REVISION',
        when: diasOffset(-2, 12, 0),
      },
      audits: [
        {
          action: 'SUBMIT_FOR_REVIEW',
          field: 'estadoFuncional',
          prev: 'SINCRONIZADO',
          next: 'EN_REVISION',
          reason: 'Envío del taller grupal a revisión',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-1, 18, 0),
          versionNumber: 1,
        },
      ],
      cronos: [
        {
          accion: 'JORNADA_CREADA',
          actor: campo.id,
          when: diasOffset(-2, 8, 0),
          titulo: 'Creó jornada grupal de taller',
        },
        {
          accion: 'FORMULARIO_ENVIADO',
          actor: campo.id,
          when: diasOffset(-2, 14, 0),
          titulo: 'Envió acta de asistencia grupal',
        },
        {
          accion: 'JORNADA_ENVIADA_REVISION',
          actor: campo.id,
          when: diasOffset(-1, 18, 0),
          titulo: 'Envió jornada grupal a revisión',
        },
      ],
    });
    console.log(`✓ EN_REVISION (grupal): ${j2.jornadaId}`);

    // 3) RECHAZADO — rechazo OPEN (bandeja Rechazadas)
    const j3 = await crearJornadaFlujo({
      idLocal: 'seed-j-rechazada',
      nombre: 'Visita predio Pedro Ramírez',
      observaciones: `Rechazada por evidencia fotográfica insuficiente ${MARCA}`,
      fecha: diasOffset(-7, 10, 0),
      estado: 'COMPLETADA',
      estadoFuncional: 'RECHAZADO',
      tipo: 'INDIVIDUAL',
      veredaId: veredaB,
      beneficiarioIds: [beneficiario2Id],
      plantilla: plantillaInd,
      cantidadEjecutada: 1,
      lat: 4.71,
      lng: -74.07,
      respuestas: [
        {
          clave: 'observaciones',
          texto: 'Se inspeccionó cultivo de café. Foto de evidencia borrosa.',
        },
        { clave: 'predios_visitados', numero: 1 },
        { clave: 'entrego_material', bool: false },
      ],
      docTitulo: 'Reporte — Visita predio Pedro Ramírez',
      docEstadoFuncional: 'RECHAZADO',
      versiones: [
        {
          versionNumber: 1,
          status: 'RECHAZADO',
          when: diasOffset(-6, 12, 0),
          changeReason: 'Generación inicial',
          campos: camposIndBase(
            'Se inspeccionó cultivo de café. Foto de evidencia borrosa.',
            1,
            false,
          ),
        },
      ],
      evidencia: {
        tipo: 'FOTO',
        nombreArchivo: 'cafe-borrosa.jpg',
        estadoFuncional: 'RECHAZADO',
        when: diasOffset(-7, 11, 30),
      },
      rechazo: {
        category: 'FOTOGRAFIA_BORROSA',
        reason:
          'La fotografía de evidencia del cultivo está borrosa y no permite validar la visita',
        requestedCorrection:
          'Adjuntar foto nítida del predio con georreferencia y volver a enviar',
        status: 'OPEN',
        when: diasOffset(-4, 9, 30),
      },
      audits: [
        {
          action: 'SUBMIT_FOR_REVIEW',
          field: 'estadoFuncional',
          prev: 'SINCRONIZADO',
          next: 'EN_REVISION',
          reason: 'Envío a revisión',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-6, 12, 0),
          versionNumber: 1,
        },
        {
          action: 'REJECT',
          field: 'estadoFuncional',
          prev: 'EN_REVISION',
          next: 'RECHAZADO',
          reason: 'Fotografía borrosa',
          userId: supervisor.id,
          role: 'COORDINADOR_ZONA',
          when: diasOffset(-4, 9, 30),
          versionNumber: 1,
        },
      ],
      cronos: [
        {
          accion: 'JORNADA_CREADA',
          actor: campo.id,
          when: diasOffset(-7, 10, 0),
          titulo: 'Creó visita a predio de Pedro Ramírez',
        },
        {
          accion: 'FORMULARIO_ENVIADO',
          actor: campo.id,
          when: diasOffset(-6, 11, 0),
          titulo: 'Envió formulario de visita',
        },
        {
          accion: 'JORNADA_ENVIADA_REVISION',
          actor: campo.id,
          when: diasOffset(-6, 12, 0),
          titulo: 'Envió jornada a revisión',
        },
        {
          accion: 'JORNADA_RECHAZADA',
          actor: supervisor.id,
          when: diasOffset(-4, 9, 30),
          titulo: 'Rechazó la jornada por fotografía borrosa',
        },
      ],
    });
    console.log(`✓ RECHAZADO (open): ${j3.jornadaId}`);

    // 4) EN_CORRECCION — técnico corrigiendo (bandeja Corrección)
    const j4 = await crearJornadaFlujo({
      idLocal: 'seed-j-en-correccion',
      nombre: 'Seguimiento riego María Pérez',
      observaciones: `En corrección: falta firma del beneficiario ${MARCA}`,
      fecha: diasOffset(-8, 9, 30),
      estado: 'COMPLETADA',
      estadoFuncional: 'EN_CORRECCION',
      tipo: 'INDIVIDUAL',
      veredaId: veredaA,
      beneficiarioIds: [beneficiarioId],
      plantilla: plantillaInd,
      cantidadEjecutada: 1,
      lat: 4.61,
      lng: -74.08,
      respuestas: [
        {
          clave: 'observaciones',
          texto: 'Seguimiento al sistema de riego. Firma pendiente de recoger.',
        },
        { clave: 'predios_visitados', numero: 1 },
        { clave: 'entrego_material', bool: true },
      ],
      docTitulo: 'Reporte — Seguimiento riego María Pérez',
      docEstadoFuncional: 'RECHAZADO',
      versiones: [
        {
          versionNumber: 1,
          status: 'RECHAZADO',
          when: diasOffset(-6, 17, 0),
          changeReason: 'Envío a revisión',
          campos: [
            ...camposIndBase(
              'Seguimiento al sistema de riego. Firma pendiente de recoger.',
              1,
              true,
            ),
            {
              clave: 'firma_beneficiario',
              etiqueta: 'Firma del beneficiario',
              tipo: 'FIRMA',
              valor: null,
            },
          ],
        },
      ],
      evidencia: {
        tipo: 'FOTO',
        nombreArchivo: 'riego-seguimiento.jpg',
        estadoFuncional: 'EN_CORRECCION',
        when: diasOffset(-8, 11, 0),
      },
      rechazo: {
        category: 'FIRMA_FALTANTE',
        reason: 'No se adjuntó la firma del beneficiario en el formulario',
        requestedCorrection:
          'Recoger firma del beneficiario en campo y generar nueva versión del documento',
        status: 'OPEN',
        when: diasOffset(-3, 14, 0),
      },
      audits: [
        {
          action: 'SUBMIT_FOR_REVIEW',
          field: 'estadoFuncional',
          prev: 'SINCRONIZADO',
          next: 'EN_REVISION',
          reason: 'Envío a revisión',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-6, 17, 0),
          versionNumber: 1,
        },
        {
          action: 'REJECT',
          field: 'estadoFuncional',
          prev: 'EN_REVISION',
          next: 'RECHAZADO',
          reason: 'Firma faltante',
          userId: supervisor.id,
          role: 'COORDINADOR_ZONA',
          when: diasOffset(-3, 14, 0),
          versionNumber: 1,
        },
        {
          action: 'UPDATE',
          field: 'estadoFuncional',
          prev: 'RECHAZADO',
          next: 'EN_CORRECCION',
          reason: 'Técnico inició corrección solicitada',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-2, 9, 0),
          versionNumber: 1,
        },
      ],
      cronos: [
        {
          accion: 'JORNADA_CREADA',
          actor: campo.id,
          when: diasOffset(-8, 9, 30),
          titulo: 'Creó jornada de seguimiento de riego',
        },
        {
          accion: 'JORNADA_ENVIADA_REVISION',
          actor: campo.id,
          when: diasOffset(-6, 17, 0),
          titulo: 'Envió jornada a revisión',
        },
        {
          accion: 'JORNADA_RECHAZADA',
          actor: supervisor.id,
          when: diasOffset(-3, 14, 0),
          titulo: 'Rechazó por firma faltante',
        },
      ],
    });
    console.log(`✓ EN_CORRECCION: ${j4.jornadaId}`);

    // 5) APROBADO — con approval + versión APROBADO
    const j5 = await crearJornadaFlujo({
      idLocal: 'seed-j-aprobada',
      nombre: 'Entrega de insumos Pedro Ramírez',
      observaciones: `Jornada aprobada por supervisor ${MARCA}`,
      fecha: diasOffset(-12, 8, 0),
      estado: 'COMPLETADA',
      estadoFuncional: 'APROBADO',
      tipo: 'INDIVIDUAL',
      veredaId: veredaB,
      beneficiarioIds: [beneficiario2Id],
      plantilla: plantillaInd,
      cantidadEjecutada: 3,
      lat: 4.72,
      lng: -74.06,
      respuestas: [
        {
          clave: 'observaciones',
          texto:
            'Se entregaron 3 kits de insumos y se capacitó en dosificación.',
        },
        { clave: 'predios_visitados', numero: 3 },
        { clave: 'entrego_material', bool: true },
      ],
      docTitulo: 'Reporte — Entrega de insumos Pedro Ramírez',
      docEstadoFuncional: 'APROBADO',
      versiones: [
        {
          versionNumber: 1,
          status: 'GENERADO',
          when: diasOffset(-11, 16, 0),
          changeReason: 'Primera generación',
          campos: camposIndBase(
            'Se entregaron kits. Falta confirmar cantidad exacta.',
            2,
            true,
          ),
        },
        {
          versionNumber: 2,
          status: 'APROBADO',
          when: diasOffset(-9, 16, 0),
          changeReason: 'Ajuste de cantidad de predios visitados',
          campos: camposIndBase(
            'Se entregaron 3 kits de insumos y se capacitó en dosificación.',
            3,
            true,
          ),
        },
      ],
      evidencia: {
        tipo: 'FOTO',
        nombreArchivo: 'entrega-insumos.jpg',
        estadoFuncional: 'APROBADO',
        when: diasOffset(-12, 11, 0),
      },
      rechazo: {
        category: 'INFORMACION_INCOMPLETA',
        reason: 'Cantidad de predios no coincidía con la meta reportada',
        requestedCorrection: 'Ajustar predios visitados a 3 y reenviar',
        status: 'RESOLVED',
        when: diasOffset(-10, 15, 0),
        resolvedAt: diasOffset(-9, 16, 0),
        resolvedBy: campo.id,
        resolutionVersionNumber: 2,
      },
      aprobacion: {
        when: diasOffset(-8, 11, 0),
        notes: 'Documentación completa y evidencia válida. Aprobado.',
      },
      audits: [
        {
          action: 'SUBMIT_FOR_REVIEW',
          field: 'estadoFuncional',
          prev: 'SINCRONIZADO',
          next: 'EN_REVISION',
          reason: 'Envío a revisión',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-11, 16, 0),
          versionNumber: 1,
        },
        {
          action: 'REJECT',
          field: 'estadoFuncional',
          prev: 'EN_REVISION',
          next: 'RECHAZADO',
          reason: 'Cantidad de predios incompleta',
          userId: supervisor.id,
          role: 'COORDINADOR_ZONA',
          when: diasOffset(-10, 15, 0),
          versionNumber: 1,
        },
        {
          action: 'CREATE_VERSION',
          field: null,
          prev: { versionNumber: 1 },
          next: { versionNumber: 2 },
          reason: 'Ajuste de cantidad de predios visitados',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-9, 16, 0),
          versionNumber: 2,
        },
        {
          action: 'RESUBMIT',
          field: 'estadoFuncional',
          prev: 'EN_CORRECCION',
          next: 'EN_REVISION',
          reason: 'Reenvío tras ajuste',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-9, 16, 15),
          versionNumber: 2,
        },
        {
          action: 'APPROVE',
          field: 'estadoFuncional',
          prev: 'EN_REVISION',
          next: 'APROBADO',
          reason: 'Documentación completa y evidencia válida',
          userId: supervisor.id,
          role: 'COORDINADOR_ZONA',
          when: diasOffset(-8, 11, 0),
          versionNumber: 2,
        },
      ],
      cronos: [
        {
          accion: 'JORNADA_CREADA',
          actor: campo.id,
          when: diasOffset(-12, 8, 0),
          titulo: 'Creó jornada de entrega de insumos',
        },
        {
          accion: 'JORNADA_ENVIADA_REVISION',
          actor: campo.id,
          when: diasOffset(-11, 16, 0),
          titulo: 'Envió jornada a revisión',
        },
        {
          accion: 'JORNADA_RECHAZADA',
          actor: supervisor.id,
          when: diasOffset(-10, 15, 0),
          titulo: 'Solicitó ajuste de predios',
        },
        {
          accion: 'JORNADA_REENVIADA_REVISION',
          actor: campo.id,
          when: diasOffset(-9, 16, 15),
          titulo: 'Reenvió jornada corregida',
        },
        {
          accion: 'JORNADA_APROBADA',
          actor: supervisor.id,
          when: diasOffset(-8, 11, 0),
          titulo: 'Aprobó la jornada',
        },
      ],
    });
    console.log(`✓ APROBADO: ${j5.jornadaId}`);

    // 6) SINCRONIZADO — lista para enviar a revisión (técnico)
    const j6 = await crearJornadaFlujo({
      idLocal: 'seed-j-sincronizada',
      nombre: 'Captura lista — parcela demostrativa',
      observaciones: `Captura sincronizada, pendiente enviar a revisión ${MARCA}`,
      fecha: diasOffset(-1, 7, 0),
      estado: 'COMPLETADA',
      estadoFuncional: 'SINCRONIZADO',
      tipo: 'INDIVIDUAL',
      veredaId: veredaA,
      beneficiarioIds: [beneficiarioId],
      plantilla: plantillaInd,
      cantidadEjecutada: 1,
      lat: 4.6,
      lng: -74.09,
      respuestas: [
        {
          clave: 'observaciones',
          texto: 'Parcela demostrativa lista. Pendiente revisión del supervisor.',
        },
        { clave: 'predios_visitados', numero: 1 },
        { clave: 'entrego_material', bool: true },
      ],
      conDocumento: true,
      docTitulo: 'Borrador reporte — Parcela demostrativa',
      docEstadoFuncional: 'SINCRONIZADO',
      versiones: [
        {
          versionNumber: 1,
          status: 'GENERADO',
          when: diasOffset(-1, 8, 0),
          changeReason: 'Borrador generado al sincronizar',
          campos: camposIndBase(
            'Parcela demostrativa lista. Pendiente revisión del supervisor.',
            1,
            true,
          ),
        },
      ],
      evidencia: {
        tipo: 'FOTO',
        nombreArchivo: 'parcela-demo.jpg',
        estadoFuncional: 'SINCRONIZADO',
        when: diasOffset(-1, 7, 30),
      },
      audits: [
        {
          action: 'UPDATE',
          field: 'estadoFuncional',
          prev: 'CAPTURADO',
          next: 'SINCRONIZADO',
          reason: 'Sincronización desde dispositivo de campo',
          userId: campo.id,
          role: 'CAMPO',
          when: diasOffset(-1, 8, 0),
          versionNumber: 1,
        },
      ],
      cronos: [
        {
          accion: 'JORNADA_CREADA',
          actor: campo.id,
          when: diasOffset(-1, 7, 0),
          titulo: 'Creó jornada de parcela demostrativa',
        },
        {
          accion: 'FORMULARIO_ENVIADO',
          actor: campo.id,
          when: diasOffset(-1, 7, 45),
          titulo: 'Sincronizó captura de formulario',
        },
      ],
    });
    console.log(`✓ SINCRONIZADO: ${j6.jornadaId}`);

    // 7) BORRADOR — jornada futura planificada
    const j7 = await crearJornadaFlujo({
      idLocal: 'seed-j-futura',
      nombre: 'Visita de seguimiento programada',
      observaciones: `Jornada futura planificada ${MARCA}`,
      fecha: diasOffset(10, 8, 30),
      estado: 'PLANIFICADA',
      estadoFuncional: 'BORRADOR',
      tipo: 'INDIVIDUAL',
      veredaId: veredaB,
      beneficiarioIds: [beneficiarioId, beneficiario2Id],
      plantilla: plantillaInd,
      cantidadEjecutada: null,
      sincronizado: false,
      conDocumento: false,
      versiones: [],
      cronos: [
        {
          accion: 'JORNADA_CREADA',
          actor: campo.id,
          when: new Date(),
          titulo: 'Creó jornada futura de seguimiento',
        },
      ],
    });
    console.log(`✓ BORRADOR (futura): ${j7.jornadaId}`);

    await client.query('COMMIT');

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(' Seed plataforma listo');
    console.log('═══════════════════════════════════════════════════');
    console.log(` Proyecto: ${PROYECTO_NOMBRE}`);
    console.log(` URL jornadas: /proyectos/${proyectoId}?tab=jornadas`);
    console.log(` Bandeja:      /revision`);
    console.log(` Seguimiento:  /seguimiento`);
    console.log('');
    console.log(' Credenciales (si Firebase OK):');
    console.log(`   Admin:       ${USUARIOS.admin.correo}`);
    console.log(`   Supervisor:  ${USUARIOS.supervisor.correo}`);
    console.log(`   Técnico:     ${USUARIOS.campo.correo}`);
    console.log(`   Contraseña:  ${PASSWORD}`);
    console.log('');
    console.log(' Qué ver en /revision (supervisor):');
    console.log('   · Pendientes     → Visita María Pérez + Taller grupal');
    console.log('   · Rechazadas     → Visita Pedro Ramírez (foto borrosa)');
    console.log('   · En corrección  → Seguimiento riego (firma faltante)');
    console.log('   · Aprobadas      → Entrega de insumos Pedro');
    console.log(' Qué ver (técnico):');
    console.log('   · Borradores / Sincronizado / Corrección / Rechazadas / Aprobadas');
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
