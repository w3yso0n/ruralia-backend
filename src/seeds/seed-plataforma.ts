/**
 * Seed completo de plataforma (catálogo + flujo real + bandeja RF-18/RF-19).
 *
 * Crea de forma idempotente un dataset para que el panel se vea poblado:
 *  - 9 usuarios (todos los roles de sistema) con login Firebase si hay credenciales
 *  - 14 beneficiarios + 4 asociaciones + varias veredas
 *  - 6 proyectos (ACTIVO / COMPLETADO / SUSPENDIDO / BORRADOR) con personal y territorios
 *  - Plan rico: varias actividades/subactividades/procesos/metas + periodos
 *  - Plantillas INDIVIDUAL/GRUPAL/diagnóstico con campos variados
 *  - Jornadas de vitrina (bandeja de revisión) + volumen histórico (dashboard, evaluaciones)
 *  - Asignaciones de meta, indicadores, documentos externos, asistencia grupal
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
const FIRMA_MINIMA =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const USUARIOS = {
  admin: {
    correo: 'admin.seed@ruralia.local',
    nombre: 'Admin Semilla Ruralia',
    rol: 'ADMINISTRADOR',
    firebaseUidFallback: 'seed-plataforma-admin',
  },
  cuantiva: {
    correo: 'cuantiva.seed@ruralia.local',
    nombre: 'Cuantiva Semilla',
    rol: 'CUANTIVA',
    firebaseUidFallback: 'seed-plataforma-cuantiva',
  },
  coordDepto: {
    correo: 'coord.depto.seed@ruralia.local',
    nombre: 'Coordinadora Departamental Semilla',
    rol: 'COORDINADOR_DEPARTAMENTAL',
    firebaseUidFallback: 'seed-plataforma-coord-depto',
  },
  supervisor: {
    correo: 'supervisor.seed@ruralia.local',
    nombre: 'Supervisor Zona Semilla',
    rol: 'COORDINADOR_ZONA',
    firebaseUidFallback: 'seed-plataforma-supervisor',
  },
  supervisor2: {
    correo: 'supervisor2.seed@ruralia.local',
    nombre: 'Supervisor Zona Norte',
    rol: 'COORDINADOR_ZONA',
    firebaseUidFallback: 'seed-plataforma-supervisor2',
  },
  campo: {
    correo: 'campo.seed@ruralia.local',
    nombre: 'Técnico Campo Semilla',
    rol: 'CAMPO',
    firebaseUidFallback: 'seed-plataforma-campo',
  },
  campo2: {
    correo: 'campo2.seed@ruralia.local',
    nombre: 'Técnica Campo Laura Méndez',
    rol: 'CAMPO',
    firebaseUidFallback: 'seed-plataforma-campo2',
  },
  campo3: {
    correo: 'campo3.seed@ruralia.local',
    nombre: 'Técnico Campo Julián Rocha',
    rol: 'CAMPO',
    firebaseUidFallback: 'seed-plataforma-campo3',
  },
  visualizador: {
    correo: 'visualizador.seed@ruralia.local',
    nombre: 'Visualizador Semilla',
    rol: 'VISUALIZADOR',
    firebaseUidFallback: 'seed-plataforma-visualizador',
  },
} as const;

const PROYECTOS_EXTRA = [
  {
    clave: 'ambiental',
    nombre: 'Restauración hídrica Sumapaz',
    tipo: 'AMBIENTAL',
    estado: 'ACTIVO',
    descripcion: `Restauración de cuencas y nacimientos en Sumapaz ${MARCA}`,
    diasInicio: -200,
    diasFin: 220,
  },
  {
    clave: 'turismo',
    nombre: 'Turismo comunitario Villa de Leyva',
    tipo: 'TURISMO',
    estado: 'ACTIVO',
    descripcion: `Rutas rurales, gastronomía y hospedaje comunitario ${MARCA}`,
    diasInicio: -60,
    diasFin: 300,
  },
  {
    clave: 'completado',
    nombre: 'Cierre ciclo caficultor 2025',
    tipo: 'AGRICOLA',
    estado: 'COMPLETADO',
    descripcion: `Ciclo productivo cerrado con meta cumplida ${MARCA}`,
    diasInicio: -400,
    diasFin: -30,
  },
  {
    clave: 'suspendido',
    nombre: 'Piloto apicultura páramo',
    tipo: 'OTRO',
    estado: 'SUSPENDIDO',
    descripcion: `Piloto suspendido por temporada invernal ${MARCA}`,
    diasInicio: -120,
    diasFin: 90,
  },
  {
    clave: 'borrador',
    nombre: 'Formulación riego parcelario',
    tipo: 'AGRICOLA',
    estado: 'BORRADOR',
    descripcion: `Proyecto en formulación, aún sin activar ${MARCA}`,
    diasInicio: 15,
    diasFin: 400,
  },
] as const;

const BENEFICIARIOS_EXTRA = [
  {
    doc: '1098765434',
    nombres: 'Lucía',
    apellidos: 'Castaño Ríos',
    telefono: '3101112233',
    correo: 'lucia.castano@ruralia.demo',
    genero: 'FEMENINO',
    fechaNac: '1990-06-21',
  },
  {
    doc: '1098765435',
    nombres: 'José',
    apellidos: 'Hernández Melo',
    telefono: '3112223344',
    correo: 'jose.hernandez@ruralia.demo',
    genero: 'MASCULINO',
    fechaNac: '1972-11-08',
  },
  {
    doc: '1098765436',
    nombres: 'Ana',
    apellidos: 'Sánchez Quintero',
    telefono: '3123334455',
    correo: 'ana.sanchez@ruralia.demo',
    genero: 'FEMENINO',
    fechaNac: '1988-02-17',
  },
  {
    doc: '1098765437',
    nombres: 'Carlos',
    apellidos: 'Gutiérrez Peña',
    telefono: '3134445566',
    correo: 'carlos.gutierrez@ruralia.demo',
    genero: 'MASCULINO',
    fechaNac: '1981-07-29',
  },
  {
    doc: '1098765438',
    nombres: 'Yolanda',
    apellidos: 'Morales Díaz',
    telefono: '3145556677',
    correo: 'yolanda.morales@ruralia.demo',
    genero: 'FEMENINO',
    fechaNac: '1969-12-04',
  },
  {
    doc: '1098765439',
    nombres: 'Andrés',
    apellidos: 'Rojas Camargo',
    telefono: '3156667788',
    correo: 'andres.rojas@ruralia.demo',
    genero: 'MASCULINO',
    fechaNac: '1994-03-15',
  },
  {
    doc: '1098765440',
    nombres: 'Fabiola',
    apellidos: 'León Vargas',
    telefono: '3167778899',
    correo: 'fabiola.leon@ruralia.demo',
    genero: 'FEMENINO',
    fechaNac: '1976-09-22',
  },
  {
    doc: '1098765441',
    nombres: 'Miguel',
    apellidos: 'Torres Cárdenas',
    telefono: '3178889900',
    correo: 'miguel.torres@ruralia.demo',
    genero: 'MASCULINO',
    fechaNac: '1983-01-11',
  },
  {
    doc: '1098765442',
    nombres: 'Gloria',
    apellidos: 'Pineda Suárez',
    telefono: '3189990011',
    correo: 'gloria.pineda@ruralia.demo',
    genero: 'FEMENINO',
    fechaNac: '1965-05-30',
  },
  {
    doc: '1098765443',
    nombres: 'Héctor',
    apellidos: 'Nieto Parra',
    telefono: '3190001122',
    correo: 'hector.nieto@ruralia.demo',
    genero: 'MASCULINO',
    fechaNac: '1979-08-19',
  },
  {
    doc: '1098765444',
    nombres: 'Patricia',
    apellidos: 'Álvarez Ruiz',
    telefono: '3201237788',
    correo: 'patricia.alvarez@ruralia.demo',
    genero: 'FEMENINO',
    fechaNac: '1992-10-07',
  },
  {
    doc: '1098765445',
    nombres: 'Diego',
    apellidos: 'Cifuentes Mora',
    telefono: '3212348899',
    correo: 'diego.cifuentes@ruralia.demo',
    genero: 'MASCULINO',
    fechaNac: '1986-04-25',
  },
] as const;

const ASOCIACIONES_SEED = [
  {
    nombre: 'ASOCAFÉ El Roble',
    nit: '900123456-1',
    representante: 'María Pérez Gómez',
    telefono: '6014455667',
    correo: 'asocafe.roble@ruralia.demo',
  },
  {
    nombre: 'Asociación de Mujeres Rurales Sumapaz',
    nit: '900234567-2',
    representante: 'Lucía Castaño Ríos',
    telefono: '6015566778',
    correo: 'mujeres.sumapaz@ruralia.demo',
  },
  {
    nombre: 'Cooperativa Agroecológica Boyacá',
    nit: '900345678-3',
    representante: 'José Hernández Melo',
    telefono: '6086677889',
    correo: 'coop.agroboyaca@ruralia.demo',
  },
  {
    nombre: 'Red de Turismo Comunitario Villa de Leyva',
    nit: '900456789-4',
    representante: 'Ana Sánchez Quintero',
    telefono: '6087788990',
    correo: 'turismo.vdl@ruralia.demo',
  },
] as const;

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
      const porCorreo = await client.query(
        `SELECT id FROM usuarios WHERE correo = $1 LIMIT 1`,
        [def.correo],
      );
      const porUid = await client.query(
        `SELECT id FROM usuarios WHERE firebase_uid = $1 LIMIT 1`,
        [fb.uid],
      );
      if (
        porCorreo.rows[0] &&
        porUid.rows[0] &&
        porCorreo.rows[0].id !== porUid.rows[0].id
      ) {
        await client.query(
          `UPDATE usuarios SET firebase_uid = $1 WHERE id = $2`,
          [`${fb.uid}-prev-${porUid.rows[0].id}`, porUid.rows[0].id],
        );
      }
      let id: string;
      if (porCorreo.rows[0]) {
        id = porCorreo.rows[0].id as string;
        await client.query(
          `UPDATE usuarios
           SET nombre_completo = $1, correo = $2, firebase_uid = $3, esta_activo = true
           WHERE id = $4`,
          [def.nombre, def.correo, fb.uid, id],
        );
      } else if (porUid.rows[0]) {
        id = porUid.rows[0].id as string;
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
    const cuantiva = await upsertUsuario(USUARIOS.cuantiva);
    const coordDepto = await upsertUsuario(USUARIOS.coordDepto);
    const supervisor = await upsertUsuario(USUARIOS.supervisor);
    const supervisor2 = await upsertUsuario(USUARIOS.supervisor2);
    const campo = await upsertUsuario(USUARIOS.campo);
    const campo2 = await upsertUsuario(USUARIOS.campo2);
    const campo3 = await upsertUsuario(USUARIOS.campo3);
    const visualizador = await upsertUsuario(USUARIOS.visualizador);

    async function tablaExiste(nombre: string): Promise<boolean> {
      const r = await client.query(
        `SELECT to_regclass('public.${nombre}') AS n`,
      );
      return Boolean(r.rows[0]?.n);
    }

    // —— Veredas (preferir códigos DANE conocidos; si no hay catálogo, crear demo) ——
    async function asegurarVeredasDemo(): Promise<void> {
      const region = await client.query(
        `INSERT INTO regiones (id, nombre, codigo, descripcion, esta_activo)
         VALUES (gen_random_uuid(), 'Andina', 'ANDINA', 'Región Andina de demostración', true)
         ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
         RETURNING id`,
      );
      const regionId = region.rows[0].id as string;
      async function depto(nombre: string, codigo: string): Promise<string> {
        const r = await client.query(
          `INSERT INTO departamentos (id, nombre, codigo, esta_activo, region_id)
           VALUES (gen_random_uuid(), $1, $2, true, $3)
           ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, esta_activo = true
           RETURNING id`,
          [nombre, codigo, regionId],
        );
        return r.rows[0].id as string;
      }
      async function mun(nombre: string, codigo: string, deptId: string): Promise<string> {
        const r = await client.query(
          `INSERT INTO municipios (id, nombre, codigo, esta_activo, departamento_id)
           VALUES (gen_random_uuid(), $1, $2, true, $3)
           ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, esta_activo = true
           RETURNING id`,
          [nombre, codigo, deptId],
        );
        return r.rows[0].id as string;
      }
      const cund = await depto('Cundinamarca', '25');
      const ant = await depto('Antioquia', '05');
      const boy = await depto('Boyacá', '15');
      const gua = await depto('Guainía', '94');
      const bogota = await mun('Bogotá, D.C.', '11001', cund);
      const agua = await mun('Agua de Dios', '25001', cund);
      const med = await mun('Medellín', '05001', ant);
      const tunja = await mun('Tunja', '15001', boy);
      const inirida = await mun('Inírida', '94001', gua);
      const demo: { codigo: string; nombre: string; munId: string; lat: number; lng: number }[] = [
        { codigo: '25001009', nombre: 'El Colegio', munId: agua, lat: 4.58, lng: -74.45 },
        { codigo: '11001051', nombre: 'Sumapaz', munId: bogota, lat: 4.25, lng: -74.18 },
        { codigo: '05895011', nombre: 'Santa Elena', munId: med, lat: 6.21, lng: -75.5 },
        { codigo: '94001003', nombre: 'La Ceiba', munId: inirida, lat: 3.86, lng: -67.92 },
        { codigo: '15001001', nombre: 'La Colorada', munId: tunja, lat: 5.54, lng: -73.36 },
        { codigo: '05001001', nombre: 'San Cristóbal', munId: med, lat: 6.28, lng: -75.63 },
        { codigo: '68001001', nombre: 'San José', munId: tunja, lat: 5.53, lng: -73.37 },
        { codigo: '17001001', nombre: 'El Roble', munId: agua, lat: 4.55, lng: -74.5 },
      ];
      for (const v of demo) {
        await client.query(
          `INSERT INTO veredas (id, nombre, codigo, esta_activo, latitud, longitud, municipio_id)
           VALUES (gen_random_uuid(), $1, $2, true, $3, $4, $5)
           ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, esta_activo = true`,
          [v.nombre, v.codigo, v.lat, v.lng, v.munId],
        );
      }
    }

    const countVeredas = await client.query(`SELECT COUNT(*)::int AS n FROM veredas`);
    if (!countVeredas.rows[0]?.n) {
      console.log('No hay catálogo DANE; se crean veredas de demostración…');
      await asegurarVeredasDemo();
    }

    const codigosPreferidos = [
      '25001009',
      '11001051',
      '05895011',
      '94001003',
      '15001001',
      '05001001',
      '68001001',
      '17001001',
    ];
    const veredas: string[] = [];
    for (const codigo of codigosPreferidos) {
      const v = await client.query(
        `SELECT id, nombre FROM veredas WHERE codigo = $1 LIMIT 1`,
        [codigo],
      );
      if (v.rows[0]) veredas.push(v.rows[0].id as string);
    }
    if (veredas.length < 8) {
      const extras = await client.query(
        `SELECT id FROM veredas WHERE id != ALL($1::uuid[]) LIMIT $2`,
        [
          veredas.length ? veredas : ['00000000-0000-0000-0000-000000000000'],
          8 - veredas.length,
        ],
      );
      for (const r of extras.rows) veredas.push(r.id as string);
    }
    if (!veredas.length) {
      await asegurarVeredasDemo();
      const retry = await client.query(`SELECT id FROM veredas LIMIT 8`);
      for (const r of retry.rows) veredas.push(r.id as string);
    }
    if (!veredas.length) {
      throw new Error(
        'No hay veredas. Corre: pnpm run seed:territorios',
      );
    }
    const veredaA = veredas[0];
    const veredaB = veredas[1] ?? veredas[0];
    const veredaC = veredas[2] ?? veredaA;
    const veredaD = veredas[3] ?? veredaB;
    const veredaE = veredas[4] ?? veredaA;
    const veredaF = veredas[5] ?? veredaB;
    console.log(`✓ Veredas: ${veredas.length} territorios de cobertura`);

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
    const beneficiarioIds: string[] = [beneficiarioId, beneficiario2Id];
    const veredasCiclo = [veredaA, veredaB, veredaC, veredaD, veredaE, veredaF];
    for (let i = 0; i < BENEFICIARIOS_EXTRA.length; i++) {
      const b = BENEFICIARIOS_EXTRA[i];
      const id = await upsertBeneficiario({
        ...b,
        veredaId: veredasCiclo[i % veredasCiclo.length],
      });
      beneficiarioIds.push(id);
    }
    console.log(`✓ Beneficiarios: ${beneficiarioIds.length} productores`);

    async function upsertAsociacion(opts: {
      nombre: string;
      nit: string;
      representante: string;
      telefono: string;
      correo: string;
      veredaId: string;
    }): Promise<string> {
      const existente = await client.query(
        `SELECT id FROM asociaciones WHERE nit = $1 LIMIT 1`,
        [opts.nit],
      );
      if (existente.rows[0]) {
        const id = existente.rows[0].id as string;
        await client.query(
          `UPDATE asociaciones
           SET nombre = $1, nombre_representante = $2, telefono = $3,
               correo = $4, vereda_id = $5, esta_activo = true
           WHERE id = $6`,
          [
            opts.nombre,
            opts.representante,
            opts.telefono,
            opts.correo,
            opts.veredaId,
            id,
          ],
        );
        return id;
      }
      const creada = await client.query(
        `INSERT INTO asociaciones (
           id, nombre, nit, nombre_representante, telefono, correo, esta_activo, vereda_id
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5, true, $6
         ) RETURNING id`,
        [
          opts.nombre,
          opts.nit,
          opts.representante,
          opts.telefono,
          opts.correo,
          opts.veredaId,
        ],
      );
      return creada.rows[0].id as string;
    }

    const asociacionIds: string[] = [];
    for (let i = 0; i < ASOCIACIONES_SEED.length; i++) {
      const a = ASOCIACIONES_SEED[i];
      asociacionIds.push(
        await upsertAsociacion({
          ...a,
          veredaId: veredasCiclo[i % veredasCiclo.length],
        }),
      );
    }
    console.log(`✓ Asociaciones: ${asociacionIds.length}`);

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

    async function vincularPersonal(pid: string, uids: string[]) {
      for (const uid of uids) {
        await client.query(
          `INSERT INTO proyecto_personal (proyecto_id, usuario_id)
           SELECT $1, $2 WHERE NOT EXISTS (
             SELECT 1 FROM proyecto_personal WHERE proyecto_id = $1 AND usuario_id = $2
           )`,
          [pid, uid],
        );
      }
    }
    async function vincularVeredas(pid: string, vids: string[]) {
      for (const vid of vids) {
        await client.query(
          `INSERT INTO proyecto_veredas (proyecto_id, vereda_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [pid, vid],
        );
      }
    }
    async function vincularBeneficiarios(
      pid: string,
      bids: string[],
      principalId?: string,
    ) {
      for (const bid of bids) {
        await client.query(
          `INSERT INTO proyecto_beneficiarios (id, proyecto_id, beneficiario_id, es_principal)
           SELECT gen_random_uuid(), $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM proyecto_beneficiarios
             WHERE proyecto_id = $1 AND beneficiario_id = $2
           )`,
          [pid, bid, bid === principalId],
        );
      }
    }
    async function vincularAsociaciones(
      pid: string,
      aids: string[],
      principalId?: string,
    ) {
      for (const aid of aids) {
        await client.query(
          `INSERT INTO proyecto_asociaciones (id, proyecto_id, asociacion_id, es_principal)
           SELECT gen_random_uuid(), $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM proyecto_asociaciones
             WHERE proyecto_id = $1 AND asociacion_id = $2
           )`,
          [pid, aid, aid === principalId],
        );
      }
    }

    await vincularPersonal(proyectoId, [
      admin.id,
      cuantiva.id,
      coordDepto.id,
      supervisor.id,
      supervisor2.id,
      campo.id,
      campo2.id,
      campo3.id,
      visualizador.id,
    ]);
    await vincularVeredas(proyectoId, [
      veredaA,
      veredaB,
      veredaC,
      veredaD,
      veredaE,
    ]);
    await vincularBeneficiarios(
      proyectoId,
      beneficiarioIds.slice(0, 10),
      beneficiarioId,
    );
    await vincularAsociaciones(
      proyectoId,
      [asociacionIds[0], asociacionIds[1]],
      asociacionIds[0],
    );
    console.log(`✓ Proyecto: ${PROYECTO_NOMBRE} (${proyectoId})`);

    async function upsertProyecto(opts: {
      nombre: string;
      tipo: string;
      estado: string;
      descripcion: string;
      fechaInicio: string;
      fechaFin: string;
    }): Promise<string> {
      const existente = await client.query(
        `SELECT id FROM proyectos WHERE nombre = $1 AND tipo = $2 LIMIT 1`,
        [opts.nombre, opts.tipo],
      );
      if (existente.rows[0]) {
        const id = existente.rows[0].id as string;
        await client.query(
          `UPDATE proyectos SET
             estado = $1, descripcion = $2, fecha_inicio = $3::date,
             fecha_fin = $4::date, actualizado_en = NOW(), creador_id = $5
           WHERE id = $6`,
          [
            opts.estado,
            opts.descripcion,
            opts.fechaInicio,
            opts.fechaFin,
            admin.id,
            id,
          ],
        );
        return id;
      }
      const creado = await client.query(
        `INSERT INTO proyectos (
           id, nombre, descripcion, tipo, estado, fecha_inicio, fecha_fin,
           creado_en, actualizado_en, creador_id
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5::date, $6::date,
           NOW(), NOW(), $7
         ) RETURNING id`,
        [
          opts.nombre,
          opts.descripcion,
          opts.tipo,
          opts.estado,
          opts.fechaInicio,
          opts.fechaFin,
          admin.id,
        ],
      );
      return creado.rows[0].id as string;
    }

    const proyectosExtraIds: Record<string, string> = {};
    for (const extra of PROYECTOS_EXTRA) {
      proyectosExtraIds[extra.clave] = await upsertProyecto({
        nombre: extra.nombre,
        tipo: extra.tipo,
        estado: extra.estado,
        descripcion: extra.descripcion,
        fechaInicio: fechaSql(diasOffset(extra.diasInicio)),
        fechaFin: fechaSql(diasOffset(extra.diasFin)),
      });
    }

    const ambientalId = proyectosExtraIds.ambiental;
    const turismoId = proyectosExtraIds.turismo;
    const completadoId = proyectosExtraIds.completado;
    const suspendidoId = proyectosExtraIds.suspendido;
    const borradorId = proyectosExtraIds.borrador;

    await vincularPersonal(ambientalId, [
      admin.id,
      coordDepto.id,
      supervisor2.id,
      campo2.id,
      campo3.id,
    ]);
    await vincularVeredas(ambientalId, [veredaC, veredaD, veredaE]);
    await vincularBeneficiarios(
      ambientalId,
      beneficiarioIds.slice(2, 8),
      beneficiarioIds[2],
    );
    await vincularAsociaciones(ambientalId, [asociacionIds[1]], asociacionIds[1]);

    await vincularPersonal(turismoId, [
      admin.id,
      supervisor.id,
      campo3.id,
      visualizador.id,
    ]);
    await vincularVeredas(turismoId, [veredaE, veredaF]);
    await vincularBeneficiarios(
      turismoId,
      beneficiarioIds.slice(8, 12),
      beneficiarioIds[8],
    );
    await vincularAsociaciones(turismoId, [asociacionIds[3]], asociacionIds[3]);

    await vincularPersonal(completadoId, [
      admin.id,
      supervisor.id,
      campo.id,
      campo2.id,
    ]);
    await vincularVeredas(completadoId, [veredaA, veredaB]);
    await vincularBeneficiarios(
      completadoId,
      [beneficiarioId, beneficiario2Id, beneficiarioIds[3]],
      beneficiarioId,
    );
    await vincularAsociaciones(completadoId, [asociacionIds[0]], asociacionIds[0]);

    await vincularPersonal(suspendidoId, [admin.id, supervisor2.id, campo3.id]);
    await vincularVeredas(suspendidoId, [veredaF]);
    await vincularBeneficiarios(suspendidoId, [beneficiarioIds[11]], beneficiarioIds[11]);

    await vincularPersonal(borradorId, [admin.id, coordDepto.id, campo2.id]);
    await vincularVeredas(borradorId, [veredaA, veredaC]);
    console.log(
      `✓ Proyectos extra: ambiental, turismo, completado, suspendido, borrador`,
    );

    const todosProyectoIds = [
      proyectoId,
      ambientalId,
      turismoId,
      completadoId,
      suspendidoId,
      borradorId,
    ];

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
      if (await tablaExiste('registros_indicador')) {
        await client.query(
          `DELETE FROM registros_indicador WHERE jornada_id = ANY($1::uuid[])`,
          [jIds],
        );
      }
      if (await tablaExiste('documentos_externos')) {
        await client.query(
          `DELETE FROM documentos_externos WHERE jornada_id = ANY($1::uuid[])`,
          [jIds],
        );
      }
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

    if (await tablaExiste('documentos_externos')) {
      await client.query(
        `DELETE FROM documentos_externos
         WHERE proyecto_id = ANY($1::uuid[])
            OR descripcion LIKE $2`,
        [todosProyectoIds, `%${MARCA}%`],
      );
    }
    if (await tablaExiste('registros_indicador')) {
      await client.query(
        `DELETE FROM registros_indicador WHERE indicador_id IN (
           SELECT id FROM indicadores WHERE nombre LIKE $1
         )`,
        [`% S6`],
      );
    }
    if (await tablaExiste('indicador_proyectos')) {
      await client.query(
        `DELETE FROM indicador_proyectos WHERE proyecto_id = ANY($1::uuid[])`,
        [todosProyectoIds],
      );
    }

    // Limpiar plan anterior del seed (todos los proyectos semilla)
    if (await tablaExiste('asignaciones_meta')) {
      await client.query(
        `DELETE FROM asignaciones_meta WHERE meta_id IN (
           SELECT m.id FROM metas m
           JOIN procesos p ON p.id = m.proceso_id
           JOIN subactividades s ON s.id = p.subactividad_id
           JOIN actividades a ON a.id = s.actividad_id
           WHERE a.proyecto_id = ANY($1::uuid[]) AND a.descripcion LIKE $2
         )`,
        [todosProyectoIds, `%${MARCA}%`],
      );
    }
    await client.query(
      `DELETE FROM meta_periodos WHERE meta_id IN (
         SELECT m.id FROM metas m
         JOIN procesos p ON p.id = m.proceso_id
         JOIN subactividades s ON s.id = p.subactividad_id
         JOIN actividades a ON a.id = s.actividad_id
         WHERE a.proyecto_id = ANY($1::uuid[]) AND a.descripcion LIKE $2
       )`,
      [todosProyectoIds, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM plantilla_formulario_procesos WHERE proceso_id IN (
         SELECT p.id FROM procesos p
         JOIN subactividades s ON s.id = p.subactividad_id
         JOIN actividades a ON a.id = s.actividad_id
         WHERE a.proyecto_id = ANY($1::uuid[]) AND a.descripcion LIKE $2
       )`,
      [todosProyectoIds, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM metas WHERE proceso_id IN (
         SELECT p.id FROM procesos p
         JOIN subactividades s ON s.id = p.subactividad_id
         JOIN actividades a ON a.id = s.actividad_id
         WHERE a.proyecto_id = ANY($1::uuid[]) AND a.descripcion LIKE $2
       )`,
      [todosProyectoIds, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM procesos WHERE subactividad_id IN (
         SELECT s.id FROM subactividades s
         JOIN actividades a ON a.id = s.actividad_id
         WHERE a.proyecto_id = ANY($1::uuid[]) AND a.descripcion LIKE $2
       )`,
      [todosProyectoIds, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM subactividades WHERE actividad_id IN (
         SELECT id FROM actividades WHERE proyecto_id = ANY($1::uuid[]) AND descripcion LIKE $2
       )`,
      [todosProyectoIds, `%${MARCA}%`],
    );
    await client.query(
      `DELETE FROM actividades WHERE proyecto_id = ANY($1::uuid[]) AND descripcion LIKE $2`,
      [todosProyectoIds, `%${MARCA}%`],
    );

    // —— Plan completo ——
    async function insertarActividad(opts: {
      proyectoId: string;
      nombre: string;
      descripcion: string;
      orden: number;
      estadoAvance?: string;
      nota?: string;
      completadaEn?: Date;
      completadaPor?: string;
    }): Promise<string> {
      const r = await client.query(
        `INSERT INTO actividades (
           id, nombre, descripcion, orden, esta_activo, estado_avance, proyecto_id,
           nota_completado, completada_en, completada_por_id
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, true, $4, $5, $6, $7, $8
         ) RETURNING id`,
        [
          opts.nombre,
          opts.descripcion,
          opts.orden,
          opts.estadoAvance ?? 'PENDIENTE',
          opts.proyectoId,
          opts.nota ?? null,
          opts.completadaEn?.toISOString() ?? null,
          opts.completadaPor ?? null,
        ],
      );
      return r.rows[0].id as string;
    }
    async function insertarSub(opts: {
      actividadId: string;
      nombre: string;
      descripcion: string;
      objetivo: string;
      orden: number;
      estadoAvance?: string;
      nota?: string;
      completadaEn?: Date;
      completadaPor?: string;
    }): Promise<string> {
      const r = await client.query(
        `INSERT INTO subactividades (
           id, nombre, descripcion, objetivo, orden, esta_activo, estado_avance, actividad_id,
           nota_completado, completada_en, completada_por_id
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, true, $5, $6, $7, $8, $9
         ) RETURNING id`,
        [
          opts.nombre,
          opts.descripcion,
          opts.objetivo,
          opts.orden,
          opts.estadoAvance ?? 'PENDIENTE',
          opts.actividadId,
          opts.nota ?? null,
          opts.completadaEn?.toISOString() ?? null,
          opts.completadaPor ?? null,
        ],
      );
      return r.rows[0].id as string;
    }
    async function insertarProceso(
      subactividadId: string,
      nombre: string,
      descripcion: string,
      orden: number,
    ): Promise<string> {
      const r = await client.query(
        `INSERT INTO procesos (
           id, nombre, descripcion, orden, esta_activo, subactividad_id
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, true, $4
         ) RETURNING id`,
        [nombre, descripcion, orden, subactividadId],
      );
      return r.rows[0].id as string;
    }
    async function insertarMeta(
      procesoId: string,
      nombre: string,
      unidad: string,
      cantidad: number,
      orden: number,
    ): Promise<string> {
      const r = await client.query(
        `INSERT INTO metas (
           id, nombre, unidad_medida, cantidad_total, orden, esta_activo, proceso_id
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, true, $5
         ) RETURNING id`,
        [nombre, unidad, cantidad, orden, procesoId],
      );
      return r.rows[0].id as string;
    }
    async function crearPeriodos(
      metaId: string,
      cantidadPorMes: number,
      mesesAtras = 3,
      mesesAdelante = 2,
    ) {
      const base = new Date();
      for (let i = -mesesAtras; i <= mesesAdelante; i++) {
        const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
        await client.query(
          `INSERT INTO meta_periodos (id, meta_id, anio, mes, cantidad_planeada)
           SELECT gen_random_uuid(), $1, $2, $3, $4
           WHERE NOT EXISTS (
             SELECT 1 FROM meta_periodos WHERE meta_id = $1 AND anio = $2 AND mes = $3
           )`,
          [metaId, d.getFullYear(), d.getMonth() + 1, cantidadPorMes],
        );
      }
    }

    const actividadId = await insertarActividad({
      proyectoId,
      nombre: 'Fortalecimiento productivo',
      descripcion: `Actividad principal del plan ${MARCA}`,
      orden: 1,
    });
    const actividadCapId = await insertarActividad({
      proyectoId,
      nombre: 'Capacitación comunitaria',
      descripcion: `Talleres y escuelas de campo ${MARCA}`,
      orden: 2,
    });
    const actividadBaseId = await insertarActividad({
      proyectoId,
      nombre: 'Línea base y caracterización',
      descripcion: `Levantamiento inicial cerrado ${MARCA}`,
      orden: 3,
      estadoAvance: 'COMPLETADA',
      nota: 'Encuestas de línea base diligenciadas y validadas.',
      completadaEn: diasOffset(-40, 16, 0),
      completadaPor: supervisor.id,
    });

    const subactividadId = await insertarSub({
      actividadId,
      nombre: 'Asistencia técnica predial',
      descripcion: `Subactividad de campo ${MARCA}`,
      objetivo: 'Acompañar a beneficiarios en buenas prácticas',
      orden: 1,
    });
    const subInsumosId = await insertarSub({
      actividadId,
      nombre: 'Entrega de insumos',
      descripcion: `Kits, semillas y herramientas ${MARCA}`,
      objetivo: 'Distribuir material productivo con acta de entrega',
      orden: 2,
    });
    const subTalleresId = await insertarSub({
      actividadId: actividadCapId,
      nombre: 'Talleres grupales',
      descripcion: `Jornadas de formación comunitaria ${MARCA}`,
      objetivo: 'Capacitar asociaciones y productores aliados',
      orden: 1,
    });
    const subLineaBaseId = await insertarSub({
      actividadId: actividadBaseId,
      nombre: 'Caracterización inicial',
      descripcion: `Encuesta de línea base ${MARCA}`,
      objetivo: 'Registrar condiciones de partida de cada predio',
      orden: 1,
      estadoAvance: 'COMPLETADA',
      nota: 'Caracterización cerrada con 30 encuestas.',
      completadaEn: diasOffset(-42, 11, 0),
      completadaPor: campo.id,
    });

    const procesoId = await insertarProceso(
      subactividadId,
      'Visita de asistencia técnica',
      `Proceso operativo ${MARCA}`,
      1,
    );
    const procesoDiagId = await insertarProceso(
      subactividadId,
      'Diagnóstico predial',
      `Diagnóstico de suelos y riego ${MARCA}`,
      2,
    );
    const procesoKitsId = await insertarProceso(
      subInsumosId,
      'Distribución de kits',
      `Entrega de kits productivos ${MARCA}`,
      1,
    );
    const procesoTallerId = await insertarProceso(
      subTalleresId,
      'Taller de buenas prácticas',
      `Talleres grupales ${MARCA}`,
      1,
    );
    const procesoEncuestaId = await insertarProceso(
      subLineaBaseId,
      'Encuesta de línea base',
      `Formulario de caracterización ${MARCA}`,
      1,
    );

    const metaId = await insertarMeta(
      procesoId,
      'Predios acompañados',
      'predios',
      80,
      1,
    );
    const metaDiagId = await insertarMeta(
      procesoDiagId,
      'Diagnósticos prediales',
      'diagnósticos',
      30,
      1,
    );
    const metaKitsId = await insertarMeta(
      procesoKitsId,
      'Kits entregados',
      'kits',
      80,
      1,
    );
    const metaTallerId = await insertarMeta(
      procesoTallerId,
      'Talleres realizados',
      'talleres',
      16,
      1,
    );
    const metaEncuestaId = await insertarMeta(
      procesoEncuestaId,
      'Encuestas de línea base',
      'encuestas',
      30,
      1,
    );
    await crearPeriodos(metaId, 12);
    await crearPeriodos(metaDiagId, 5);
    await crearPeriodos(metaKitsId, 12);
    await crearPeriodos(metaTallerId, 2);
    await crearPeriodos(metaEncuestaId, 8, 5, 0);

    async function planSatelite(
      pid: string,
      actividad: string,
      sub: string,
      proceso: string,
      metaNombre: string,
      unidad: string,
      cantidad: number,
      estadoAvance = 'PENDIENTE',
    ): Promise<{ actividadId: string; subId: string; procesoId: string; metaId: string }> {
      const aId = await insertarActividad({
        proyectoId: pid,
        nombre: actividad,
        descripcion: `${actividad} ${MARCA}`,
        orden: 1,
        estadoAvance,
        nota: estadoAvance === 'COMPLETADA' ? 'Plan ejecutado y cerrado.' : undefined,
        completadaEn:
          estadoAvance === 'COMPLETADA' ? diasOffset(-25, 12, 0) : undefined,
        completadaPor: estadoAvance === 'COMPLETADA' ? supervisor.id : undefined,
      });
      const sId = await insertarSub({
        actividadId: aId,
        nombre: sub,
        descripcion: `${sub} ${MARCA}`,
        objetivo: sub,
        orden: 1,
        estadoAvance,
      });
      const pId = await insertarProceso(sId, proceso, `${proceso} ${MARCA}`, 1);
      const mId = await insertarMeta(pId, metaNombre, unidad, cantidad, 1);
      await crearPeriodos(mId, Math.max(1, Math.round(cantidad / 6)));
      return { actividadId: aId, subId: sId, procesoId: pId, metaId: mId };
    }

    const planAmbiental = await planSatelite(
      ambientalId,
      'Restauración de nacimientos',
      'Siembra de árboles nativos',
      'Jornada de reforestación',
      'Árboles plantados',
      'árboles',
      400,
    );
    const planTurismo = await planSatelite(
      turismoId,
      'Rutas comunitarias',
      'Señalización y guianza',
      'Taller de anfitriones',
      'Anfitriones certificados',
      'personas',
      24,
    );
    const planCierre = await planSatelite(
      completadoId,
      'Cierre productivo 2025',
      'Cosecha y comercialización',
      'Entrega de reporte final',
      'Reportes de cierre',
      'reportes',
      12,
      'COMPLETADA',
    );
    const planApicultura = await planSatelite(
      suspendidoId,
      'Piloto de colmenas',
      'Instalación de apiarios',
      'Visita de seguimiento apícola',
      'Colmenas instaladas',
      'colmenas',
      20,
    );
    await planSatelite(
      borradorId,
      'Diseño de riego',
      'Levantamiento topográfico',
      'Visita de formulación',
      'Predios formulados',
      'predios',
      15,
    );
    console.log(
      `✓ Plan: 3 actividades en proyecto principal + planes satélite`,
    );

    // —— Plantillas ——
    async function upsertPlantilla(
      nombre: string,
      tipo: 'INDIVIDUAL' | 'GRUPAL',
      camposDef: {
        etiqueta: string;
        clave: string;
        tipoCampo: string;
        orden: number;
        obligatorio: boolean;
        opciones?: unknown;
      }[],
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
      for (const uid of [campo.id, campo2.id, campo3.id, supervisor.id]) {
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
      [
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
          etiqueta: 'Estado del cultivo',
          clave: 'estado_cultivo',
          tipoCampo: 'SELECCION_UNICA',
          orden: 4,
          obligatorio: false,
          opciones: {
            valores: ['Bueno', 'Regular', 'Crítico', 'En renovación'],
          },
        },
        {
          etiqueta: 'Prácticas observadas',
          clave: 'practicas',
          tipoCampo: 'SELECCION_MULTIPLE',
          orden: 5,
          obligatorio: false,
          opciones: {
            valores: [
              'Riego tecnificado',
              'Compostaje',
              'Barreras vivas',
              'Cosecha de agua',
            ],
          },
        },
        {
          etiqueta: 'Fecha de la visita',
          clave: 'fecha_visita',
          tipoCampo: 'FECHA',
          orden: 6,
          obligatorio: false,
        },
        {
          etiqueta: 'Firma del beneficiario',
          clave: 'firma_beneficiario',
          tipoCampo: 'FIRMA',
          orden: 7,
          obligatorio: false,
        },
      ],
    );
    const plantillaGrupal = await upsertPlantilla(
      'Acta asistencia grupal S6',
      'GRUPAL',
      [
        {
          etiqueta: 'Tema de la jornada grupal',
          clave: 'tema',
          tipoCampo: 'TEXTO',
          orden: 1,
          obligatorio: true,
        },
        {
          etiqueta: 'Duración (horas)',
          clave: 'duracion_horas',
          tipoCampo: 'NUMERO',
          orden: 2,
          obligatorio: false,
        },
        {
          etiqueta: '¿Se entregaron materiales?',
          clave: 'materiales_entregados',
          tipoCampo: 'SI_NO',
          orden: 3,
          obligatorio: false,
        },
        {
          etiqueta: 'Lista de asistencia',
          clave: 'asistencia',
          tipoCampo: 'TABLA',
          orden: 4,
          obligatorio: true,
          opciones: {
            columnas: [
              { clave: 'nombre', etiqueta: 'Nombre' },
              { clave: 'documento', etiqueta: 'Documento' },
              { clave: 'firma', etiqueta: 'Firma' },
            ],
          },
        },
      ],
    );
    const plantillaDiag = await upsertPlantilla(
      'Diagnóstico predial S6',
      'INDIVIDUAL',
      [
        {
          etiqueta: 'Área del predio (ha)',
          clave: 'area_ha',
          tipoCampo: 'NUMERO',
          orden: 1,
          obligatorio: true,
        },
        {
          etiqueta: 'Fuente de agua',
          clave: 'fuente_agua',
          tipoCampo: 'SELECCION_UNICA',
          orden: 2,
          obligatorio: true,
          opciones: {
            valores: ['Nacimiento', 'Quebrada', 'Pozo', 'Acueducto veredal'],
          },
        },
        {
          etiqueta: 'Recomendaciones técnicas',
          clave: 'recomendaciones',
          tipoCampo: 'TEXTO',
          orden: 3,
          obligatorio: true,
        },
        {
          etiqueta: '¿Requiere riego?',
          clave: 'requiere_riego',
          tipoCampo: 'SI_NO',
          orden: 4,
          obligatorio: true,
        },
      ],
    );
    for (const [plantilla, proceso] of [
      [plantillaInd.id, procesoDiagId],
      [plantillaInd.id, procesoKitsId],
      [plantillaInd.id, procesoEncuestaId],
      [plantillaGrupal.id, procesoTallerId],
      [plantillaDiag.id, procesoDiagId],
      [plantillaInd.id, planAmbiental.procesoId],
      [plantillaGrupal.id, planTurismo.procesoId],
      [plantillaInd.id, planCierre.procesoId],
      [plantillaInd.id, planApicultura.procesoId],
    ] as const) {
      await client.query(
        `INSERT INTO plantilla_formulario_procesos (plantilla_formulario_id, proceso_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [plantilla, proceso],
      );
    }
    console.log(
      `✓ Plantillas: individual ${plantillaInd.id}, grupal ${plantillaGrupal.id}, diagnóstico ${plantillaDiag.id}`,
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
      tecnicoId?: string;
      tecnicoNombre?: string;
      proyectoIdOverride?: string;
      metaIdOverride?: string | null;
      asistentes?: { nombre: string; documento: string | null; orden: number }[];
      actividadId?: string;
      subactividadId?: string;
    }): Promise<{ jornadaId: string; documentoId: string | null }> {
      const pid = opts.proyectoIdOverride ?? proyectoId;
      const mid = opts.metaIdOverride === undefined ? metaId : opts.metaIdOverride;
      const tid = opts.tecnicoId ?? campo.id;
      const tnombre = opts.tecnicoNombre ?? USUARIOS.campo.nombre;
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
          pid,
          mid,
          opts.veredaId,
          tid,
          tnombre,
        ],
      );
      const jornadaId = j.rows[0].id as string;

      await client.query(
        `INSERT INTO jornada_equipo (jornada_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [jornadaId, tid],
      );
      if (opts.actividadId) {
        await client.query(
          `INSERT INTO jornada_actividades (
             id, jornada_id, actividad_id, subactividad_id, estado_ejecucion, nota, orden
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, 0
           )`,
          [
            jornadaId,
            opts.actividadId,
            opts.subactividadId ?? null,
            opts.estado === 'COMPLETADA'
              ? 'COMPLETADA'
              : opts.estado === 'EN_PROGRESO'
                ? 'EN_PROGRESO'
                : 'PENDIENTE',
            opts.observaciones,
          ],
        );
      }
      for (const bid of opts.beneficiarioIds) {
        await client.query(
          `INSERT INTO jornada_beneficiarios (jornada_id, beneficiario_id)
           SELECT $1, $2 WHERE NOT EXISTS (
             SELECT 1 FROM jornada_beneficiarios WHERE jornada_id = $1 AND beneficiario_id = $2
           )`,
          [jornadaId, bid],
        );
      }
      for (const asis of opts.asistentes ?? []) {
        await client.query(
          `INSERT INTO jornada_asistentes (
             id, jornada_id, nombre_completo, documento, firma_data_url, firmado_en, orden, creado_en
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
           )`,
          [
            jornadaId,
            asis.nombre,
            asis.documento,
            FIRMA_MINIMA,
            opts.fecha.toISOString(),
            asis.orden,
          ],
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
            tid,
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
            pid,
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
              tid,
              v.when.toISOString(),
              v.changeReason,
              prevVersionId,
              JSON.stringify({
                versionNumber: v.versionNumber,
                tecnico: tnombre,
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
            pid,
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
            pid,
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
            pid,
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
            pid,
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
      actividadId,
      subactividadId,
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
      actividadId: actividadCapId,
      subactividadId: subTalleresId,
      metaIdOverride: metaTallerId,
      asistentes: [
        {
          nombre: 'María Pérez Gómez',
          documento: BENEFICIARIO_DOC,
          orden: 0,
        },
        {
          nombre: 'Pedro Ramírez Vargas',
          documento: BENEFICIARIO_DOC_2,
          orden: 1,
        },
      ],
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

    async function jornadaAprobada(opts: {
      idLocal: string;
      nombre: string;
      dias: number;
      tipo?: 'INDIVIDUAL' | 'GRUPAL';
      veredaId: string;
      beneficiarioIds: string[];
      tecnico: { id: string; nombre: string };
      cantidad: number;
      lat: number;
      lng: number;
      obs: string;
      metaIdOverride?: string;
      proyectoIdOverride?: string;
      plantilla?: { id: string; campos: Record<string, string> };
      actividadId?: string;
      subactividadId?: string;
      asistentes?: { nombre: string; documento: string | null; orden: number }[];
    }) {
      const tipo = opts.tipo ?? 'INDIVIDUAL';
      const plantilla =
        opts.plantilla ?? (tipo === 'GRUPAL' ? plantillaGrupal : plantillaInd);
      const fecha = diasOffset(opts.dias, 8, 30);
      const respuestas: RespuestaSeed[] =
        tipo === 'GRUPAL'
          ? [
              { clave: 'tema', texto: opts.obs },
              { clave: 'duracion_horas', numero: 3 },
              { clave: 'materiales_entregados', bool: true },
              {
                clave: 'asistencia',
                json: {
                  filas: opts.beneficiarioIds.slice(0, 4).map((id, i) => ({
                    nombre:
                      opts.asistentes?.[i]?.nombre ?? `Asistente ${i + 1}`,
                    documento: opts.asistentes?.[i]?.documento ?? `10987${i}`,
                    firma: true,
                  })),
                },
              },
            ]
          : [
              { clave: 'observaciones', texto: opts.obs },
              { clave: 'predios_visitados', numero: opts.cantidad },
              { clave: 'entrego_material', bool: true },
              { clave: 'estado_cultivo', texto: 'Bueno' },
            ];
      return crearJornadaFlujo({
        idLocal: opts.idLocal,
        nombre: opts.nombre,
        observaciones: `${opts.obs} ${MARCA}`,
        fecha,
        estado: 'COMPLETADA',
        estadoFuncional: 'APROBADO',
        tipo,
        veredaId: opts.veredaId,
        beneficiarioIds: opts.beneficiarioIds,
        plantilla,
        cantidadEjecutada: opts.cantidad,
        lat: opts.lat,
        lng: opts.lng,
        tecnicoId: opts.tecnico.id,
        tecnicoNombre: opts.tecnico.nombre,
        proyectoIdOverride: opts.proyectoIdOverride,
        metaIdOverride: opts.metaIdOverride,
        actividadId: opts.actividadId,
        subactividadId: opts.subactividadId,
        asistentes: opts.asistentes,
        respuestas,
        docTitulo: `Reporte — ${opts.nombre}`,
        docEstadoFuncional: 'APROBADO',
        versiones: [
          {
            versionNumber: 1,
            status: 'APROBADO',
            when: diasOffset(opts.dias + 1, 16, 0),
            changeReason: 'Generación y aprobación de volumen semilla',
            campos:
              tipo === 'GRUPAL'
                ? [
                    {
                      clave: 'tema',
                      etiqueta: 'Tema',
                      tipo: 'TEXTO',
                      valor: opts.obs,
                    },
                  ]
                : camposIndBase(opts.obs, opts.cantidad, true),
          },
        ],
        evidencia: {
          tipo: 'FOTO',
          nombreArchivo: `${opts.idLocal}.jpg`,
          estadoFuncional: 'APROBADO',
          when: diasOffset(opts.dias, 11, 0),
        },
        aprobacion: {
          when: diasOffset(opts.dias + 2, 10, 0),
          notes: 'Documentación completa. Aprobado en dataset de demostración.',
        },
        audits: [
          {
            action: 'SUBMIT_FOR_REVIEW',
            field: 'estadoFuncional',
            prev: 'SINCRONIZADO',
            next: 'EN_REVISION',
            reason: 'Envío a revisión',
            userId: opts.tecnico.id,
            role: 'CAMPO',
            when: diasOffset(opts.dias + 1, 16, 0),
            versionNumber: 1,
          },
          {
            action: 'APPROVE',
            field: 'estadoFuncional',
            prev: 'EN_REVISION',
            next: 'APROBADO',
            reason: 'Aprobación de volumen semilla',
            userId: supervisor.id,
            role: 'COORDINADOR_ZONA',
            when: diasOffset(opts.dias + 2, 10, 0),
            versionNumber: 1,
          },
        ],
        cronos: [
          {
            accion: 'JORNADA_CREADA',
            actor: opts.tecnico.id,
            when: fecha,
            titulo: `Creó ${opts.nombre}`,
          },
          {
            accion: 'JORNADA_APROBADA',
            actor: supervisor.id,
            when: diasOffset(opts.dias + 2, 10, 0),
            titulo: `Aprobó ${opts.nombre}`,
          },
        ],
      });
    }

    const tecnicos = [
      { id: campo.id, nombre: USUARIOS.campo.nombre },
      { id: campo2.id, nombre: USUARIOS.campo2.nombre },
      { id: campo3.id, nombre: USUARIOS.campo3.nombre },
    ];
    const coords: [number, number][] = [
      [4.6097, -74.0817],
      [4.65, -74.1],
      [4.71, -74.07],
      [4.8, -74.35],
      [5.53, -73.36],
      [6.25, -75.56],
    ];

    const volumenPredios = [
      { dias: -140, nombre: 'Visita predio Lucía Castaño', bid: [beneficiarioIds[2]], vid: veredaC, cant: 2 },
      { dias: -125, nombre: 'Visita predio José Hernández', bid: [beneficiarioIds[3]], vid: veredaD, cant: 2 },
      { dias: -110, nombre: 'Acompañamiento Ana Sánchez', bid: [beneficiarioIds[4]], vid: veredaE, cant: 1 },
      { dias: -95, nombre: 'Visita predio Carlos Gutiérrez', bid: [beneficiarioIds[5]], vid: veredaA, cant: 2 },
      { dias: -80, nombre: 'Seguimiento Yolanda Morales', bid: [beneficiarioIds[6]], vid: veredaB, cant: 2 },
      { dias: -68, nombre: 'Visita predio Andrés Rojas', bid: [beneficiarioIds[7]], vid: veredaC, cant: 1 },
      { dias: -55, nombre: 'Acompañamiento Fabiola León', bid: [beneficiarioIds[8]], vid: veredaD, cant: 2 },
      { dias: -42, nombre: 'Visita predio Miguel Torres', bid: [beneficiarioIds[9]], vid: veredaE, cant: 2 },
      { dias: -28, nombre: 'Seguimiento Gloria Pineda', bid: [beneficiarioIds[10]], vid: veredaA, cant: 1 },
      { dias: -18, nombre: 'Visita predio Héctor Nieto', bid: [beneficiarioIds[11]], vid: veredaB, cant: 2 },
      { dias: -9, nombre: 'Acompañamiento Patricia Álvarez', bid: [beneficiarioIds[12]], vid: veredaC, cant: 2 },
      { dias: -3, nombre: 'Visita predio Diego Cifuentes', bid: [beneficiarioIds[13]], vid: veredaD, cant: 1 },
    ] as const;

    const jornadasVolumen: { jornadaId: string }[] = [];
    for (let i = 0; i < volumenPredios.length; i++) {
      const v = volumenPredios[i];
      const tec = tecnicos[i % tecnicos.length];
      const [lat, lng] = coords[i % coords.length];
      jornadasVolumen.push(
        await jornadaAprobada({
          idLocal: `seed-j-vol-${String(i + 1).padStart(2, '0')}`,
          nombre: v.nombre,
          dias: v.dias,
          veredaId: v.vid,
          beneficiarioIds: [...v.bid],
          tecnico: tec,
          cantidad: v.cant,
          lat,
          lng,
          obs: `Asistencia técnica predial ejecutada con registro fotográfico.`,
          metaIdOverride: metaId,
          actividadId,
          subactividadId,
        }),
      );
    }

    const kitsDefs = [
      { dias: -100, bid: [beneficiarioIds[2], beneficiarioIds[3]], cant: 8, nombre: 'Entrega kits ASOCAFÉ' },
      { dias: -70, bid: [beneficiarioIds[4], beneficiarioIds[5]], cant: 10, nombre: 'Entrega kits mujeres rurales' },
      { dias: -35, bid: [beneficiarioIds[6], beneficiarioIds[7]], cant: 8, nombre: 'Entrega kits compostaje' },
      { dias: -12, bid: [beneficiarioIds[8], beneficiarioIds[9]], cant: 6, nombre: 'Entrega kits de riego' },
    ] as const;
    for (let i = 0; i < kitsDefs.length; i++) {
      const k = kitsDefs[i];
      await jornadaAprobada({
        idLocal: `seed-j-kit-${i + 1}`,
        nombre: k.nombre,
        dias: k.dias,
        veredaId: veredasCiclo[i % veredasCiclo.length],
        beneficiarioIds: [...k.bid],
        tecnico: tecnicos[(i + 1) % tecnicos.length],
        cantidad: k.cant,
        lat: coords[i][0],
        lng: coords[i][1],
        obs: `Entrega de kits productivos con acta firmada.`,
        metaIdOverride: metaKitsId,
        actividadId,
        subactividadId: subInsumosId,
      });
    }

    const diagDefs = [
      { dias: -88, bid: beneficiarioIds[2], nombre: 'Diagnóstico predio Lucía' },
      { dias: -50, bid: beneficiarioIds[5], nombre: 'Diagnóstico predio Carlos' },
      { dias: -22, bid: beneficiarioIds[8], nombre: 'Diagnóstico predio Fabiola' },
      { dias: -6, bid: beneficiarioIds[11], nombre: 'Diagnóstico predio Héctor' },
    ] as const;
    for (let i = 0; i < diagDefs.length; i++) {
      const d = diagDefs[i];
      await jornadaAprobada({
        idLocal: `seed-j-diag-${i + 1}`,
        nombre: d.nombre,
        dias: d.dias,
        veredaId: veredasCiclo[(i + 2) % veredasCiclo.length],
        beneficiarioIds: [d.bid],
        tecnico: tecnicos[i % tecnicos.length],
        cantidad: 3,
        lat: coords[(i + 1) % coords.length][0],
        lng: coords[(i + 1) % coords.length][1],
        obs: `Diagnóstico de suelos, agua y prácticas productivas.`,
        metaIdOverride: metaDiagId,
        plantilla: plantillaDiag,
        actividadId,
        subactividadId,
      });
    }

    const tallerNombres = [
      'Taller compostaje comunitario',
      'Escuela de campo riego',
      'Taller de asociatividad',
      'Taller cosecha y poscosecha',
    ];
    for (let i = 0; i < tallerNombres.length; i++) {
      const bids = beneficiarioIds.slice(i * 2, i * 2 + 4);
      await jornadaAprobada({
        idLocal: `seed-j-taller-${i + 1}`,
        nombre: tallerNombres[i],
        dias: -120 + i * 28,
        tipo: 'GRUPAL',
        veredaId: veredasCiclo[i % veredasCiclo.length],
        beneficiarioIds: bids,
        tecnico: tecnicos[(i + 2) % tecnicos.length],
        cantidad: 2,
        lat: coords[(i + 2) % coords.length][0],
        lng: coords[(i + 2) % coords.length][1],
        obs: tallerNombres[i],
        metaIdOverride: metaTallerId,
        actividadId: actividadCapId,
        subactividadId: subTalleresId,
        asistentes: bids.map((id, idx) => ({
          nombre:
            idx === 0
              ? 'María Pérez Gómez'
              : BENEFICIARIOS_EXTRA[Math.min(idx, BENEFICIARIOS_EXTRA.length - 1)]
                  .nombres +
              ' ' +
              BENEFICIARIOS_EXTRA[Math.min(idx, BENEFICIARIOS_EXTRA.length - 1)]
                .apellidos,
          documento:
            idx === 0
              ? BENEFICIARIO_DOC
              : BENEFICIARIOS_EXTRA[Math.min(idx, BENEFICIARIOS_EXTRA.length - 1)].doc,
          orden: idx,
        })),
      });
    }

    for (let i = 0; i < 5; i++) {
      await jornadaAprobada({
        idLocal: `seed-j-base-${i + 1}`,
        nombre: `Encuesta línea base grupo ${i + 1}`,
        dias: -160 + i * 12,
        veredaId: veredasCiclo[i % veredasCiclo.length],
        beneficiarioIds: [beneficiarioIds[i], beneficiarioIds[i + 5]],
        tecnico: tecnicos[i % tecnicos.length],
        cantidad: 6,
        lat: coords[i % coords.length][0],
        lng: coords[i % coords.length][1],
        obs: `Levantamiento de línea base socioeconómica y productiva.`,
        metaIdOverride: metaEncuestaId,
        actividadId: actividadBaseId,
        subactividadId: subLineaBaseId,
      });
    }

    await jornadaAprobada({
      idLocal: 'seed-j-amb-1',
      nombre: 'Reforestación nacimiento El Roble',
      dias: -45,
      tipo: 'GRUPAL',
      veredaId: veredaC,
      beneficiarioIds: beneficiarioIds.slice(2, 6),
      tecnico: { id: campo2.id, nombre: USUARIOS.campo2.nombre },
      cantidad: 80,
      lat: 4.18,
      lng: -74.2,
      obs: 'Siembra de nativos en ronda hídrica.',
      proyectoIdOverride: ambientalId,
      metaIdOverride: planAmbiental.metaId,
      actividadId: planAmbiental.actividadId,
      subactividadId: planAmbiental.subId,
    });
    await jornadaAprobada({
      idLocal: 'seed-j-amb-2',
      nombre: 'Aislamiento de nacimiento La Vega',
      dias: -20,
      veredaId: veredaD,
      beneficiarioIds: [beneficiarioIds[4]],
      tecnico: { id: campo3.id, nombre: USUARIOS.campo3.nombre },
      cantidad: 40,
      lat: 4.22,
      lng: -74.15,
      obs: 'Cercado y siembra de aislamiento.',
      proyectoIdOverride: ambientalId,
      metaIdOverride: planAmbiental.metaId,
      actividadId: planAmbiental.actividadId,
      subactividadId: planAmbiental.subId,
    });
    await jornadaAprobada({
      idLocal: 'seed-j-tur-1',
      nombre: 'Taller de anfitriones Villa de Leyva',
      dias: -15,
      tipo: 'GRUPAL',
      veredaId: veredaE,
      beneficiarioIds: beneficiarioIds.slice(8, 12),
      tecnico: { id: campo3.id, nombre: USUARIOS.campo3.nombre },
      cantidad: 8,
      lat: 5.63,
      lng: -73.52,
      obs: 'Certificación de anfitriones comunitarios.',
      proyectoIdOverride: turismoId,
      metaIdOverride: planTurismo.metaId,
      actividadId: planTurismo.actividadId,
      subactividadId: planTurismo.subId,
    });
    await jornadaAprobada({
      idLocal: 'seed-j-cierre-1',
      nombre: 'Reporte final de cosecha',
      dias: -50,
      veredaId: veredaA,
      beneficiarioIds: [beneficiarioId, beneficiario2Id],
      tecnico: { id: campo.id, nombre: USUARIOS.campo.nombre },
      cantidad: 12,
      lat: 4.61,
      lng: -74.08,
      obs: 'Cierre documental del ciclo caficultor 2025.',
      proyectoIdOverride: completadoId,
      metaIdOverride: planCierre.metaId,
      actividadId: planCierre.actividadId,
      subactividadId: planCierre.subId,
    });
    await jornadaAprobada({
      idLocal: 'seed-j-api-1',
      nombre: 'Instalación de colmenas piloto',
      dias: -90,
      veredaId: veredaF,
      beneficiarioIds: [beneficiarioIds[11]],
      tecnico: { id: campo3.id, nombre: USUARIOS.campo3.nombre },
      cantidad: 4,
      lat: 4.95,
      lng: -74.4,
      obs: 'Apiario piloto antes de la suspensión invernal.',
      proyectoIdOverride: suspendidoId,
      metaIdOverride: planApicultura.metaId,
      actividadId: planApicultura.actividadId,
      subactividadId: planApicultura.subId,
    });

    await crearJornadaFlujo({
      idLocal: 'seed-j-rev-lucia',
      nombre: 'Visita predio Lucía — segunda ronda',
      observaciones: `Enviada a revisión ${MARCA}`,
      fecha: diasOffset(-2, 9, 0),
      estado: 'COMPLETADA',
      estadoFuncional: 'EN_REVISION',
      tipo: 'INDIVIDUAL',
      veredaId: veredaC,
      beneficiarioIds: [beneficiarioIds[2]],
      plantilla: plantillaInd,
      cantidadEjecutada: 1,
      lat: 4.2,
      lng: -74.18,
      tecnicoId: campo2.id,
      tecnicoNombre: USUARIOS.campo2.nombre,
      actividadId,
      subactividadId,
      respuestas: [
        { clave: 'observaciones', texto: 'Segunda ronda de riego. Pendiente validar foto.' },
        { clave: 'predios_visitados', numero: 1 },
        { clave: 'entrego_material', bool: true },
      ],
      docTitulo: 'Reporte — Visita Lucía segunda ronda',
      versiones: [
        {
          versionNumber: 1,
          status: 'GENERADO',
          when: diasOffset(-1, 17, 0),
          changeReason: 'Envío a revisión',
          campos: camposIndBase('Segunda ronda de riego.', 1, true),
        },
      ],
      evidencia: {
        tipo: 'FOTO',
        nombreArchivo: 'lucia-ronda2.jpg',
        estadoFuncional: 'EN_REVISION',
        when: diasOffset(-2, 11, 0),
      },
      audits: [
        {
          action: 'SUBMIT_FOR_REVIEW',
          field: 'estadoFuncional',
          prev: 'SINCRONIZADO',
          next: 'EN_REVISION',
          reason: 'Envío a revisión',
          userId: campo2.id,
          role: 'CAMPO',
          when: diasOffset(-1, 17, 0),
          versionNumber: 1,
        },
      ],
      cronos: [
        {
          accion: 'JORNADA_ENVIADA_REVISION',
          actor: campo2.id,
          when: diasOffset(-1, 17, 0),
          titulo: 'Envió jornada a revisión',
        },
      ],
    });

    await crearJornadaFlujo({
      idLocal: 'seed-j-cancelada',
      nombre: 'Jornada cancelada por lluvia',
      observaciones: `Cancelada por temporada invernal ${MARCA}`,
      fecha: diasOffset(-14, 8, 0),
      estado: 'CANCELADA',
      estadoFuncional: 'BORRADOR',
      tipo: 'INDIVIDUAL',
      veredaId: veredaF,
      beneficiarioIds: [beneficiarioIds[10]],
      plantilla: plantillaInd,
      sincronizado: false,
      conDocumento: false,
      versiones: [],
      tecnicoId: campo3.id,
      tecnicoNombre: USUARIOS.campo3.nombre,
      cronos: [
        {
          accion: 'JORNADA_CANCELADA',
          actor: campo3.id,
          when: diasOffset(-13, 9, 0),
          titulo: 'Canceló la jornada por lluvia',
        },
      ],
    });

    await crearJornadaFlujo({
      idLocal: 'seed-j-en-progreso',
      nombre: 'Jornada en curso — parcela demostrativa',
      observaciones: `Técnico en campo ${MARCA}`,
      fecha: diasOffset(0, 7, 0),
      estado: 'EN_PROGRESO',
      estadoFuncional: 'CAPTURADO',
      tipo: 'INDIVIDUAL',
      veredaId: veredaA,
      beneficiarioIds: [beneficiarioId],
      plantilla: plantillaInd,
      lat: 4.61,
      lng: -74.09,
      sincronizado: false,
      conDocumento: false,
      versiones: [],
      actividadId,
      subactividadId,
      cronos: [
        {
          accion: 'JORNADA_CREADA',
          actor: campo.id,
          when: diasOffset(0, 7, 0),
          titulo: 'Inició jornada en campo',
        },
      ],
    });

    await crearJornadaFlujo({
      idLocal: 'seed-j-futura-2',
      nombre: 'Taller grupal programado — cosecha de agua',
      observaciones: `Planificada para la próxima quincena ${MARCA}`,
      fecha: diasOffset(18, 9, 0),
      estado: 'PLANIFICADA',
      estadoFuncional: 'BORRADOR',
      tipo: 'GRUPAL',
      veredaId: veredaE,
      beneficiarioIds: beneficiarioIds.slice(4, 8),
      plantilla: plantillaGrupal,
      sincronizado: false,
      conDocumento: false,
      versiones: [],
      tecnicoId: campo2.id,
      tecnicoNombre: USUARIOS.campo2.nombre,
      metaIdOverride: metaTallerId,
      actividadId: actividadCapId,
      subactividadId: subTalleresId,
    });
    console.log('✓ Volumen: jornadas históricas, bandeja extra, cancelada y futuras');

    if (await tablaExiste('asignaciones_meta')) {
      async function asignar(
        meta: string,
        usuarioId: string,
        cantidad: number,
        notas: string,
        periodoId: string | null,
      ) {
        await client.query(
          `INSERT INTO asignaciones_meta (
             id, meta_id, usuario_id, meta_periodo_id, cantidad_asignada, notas, creado_en, actualizado_en
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW()
           )`,
          [meta, usuarioId, periodoId, cantidad, notas],
        );
      }
      const ahora = new Date();
      const periodoPredios = await client.query(
        `SELECT id FROM meta_periodos WHERE meta_id = $1 AND anio = $2 AND mes = $3 LIMIT 1`,
        [metaId, ahora.getFullYear(), ahora.getMonth() + 1],
      );
      const periodoKits = await client.query(
        `SELECT id FROM meta_periodos WHERE meta_id = $1 AND anio = $2 AND mes = $3 LIMIT 1`,
        [metaKitsId, ahora.getFullYear(), ahora.getMonth() + 1],
      );
      const pPredios = (periodoPredios.rows[0]?.id as string) ?? null;
      const pKits = (periodoKits.rows[0]?.id as string) ?? null;
      await asignar(metaId, campo.id, 15, 'Cuota mensual de predios — técnico semilla', pPredios);
      await asignar(metaId, campo2.id, 10, 'Cuota mensual zona Sumapaz', pPredios);
      await asignar(metaId, campo3.id, 8, 'Cuota mensual zona norte', pPredios);
      await asignar(metaKitsId, campo.id, 20, 'Kits del mes — técnico semilla', pKits);
      await asignar(metaKitsId, campo2.id, 16, 'Kits del mes — Laura Méndez', pKits);
      await asignar(metaTallerId, campo3.id, 2, 'Talleres del mes', null);
      await asignar(metaDiagId, campo2.id, 4, 'Diagnósticos del mes', null);
      console.log('✓ Asignaciones de meta para evaluaciones');
    }

    if (await tablaExiste('indicadores')) {
      async function upsertIndicador(opts: {
        nombre: string;
        unidad: string;
        valorMeta: number;
        tipo: string;
        frecuencia: string;
      }): Promise<string> {
        const ex = await client.query(
          `SELECT id FROM indicadores WHERE nombre = $1 LIMIT 1`,
          [opts.nombre],
        );
        if (ex.rows[0]) {
          const id = ex.rows[0].id as string;
          await client.query(
            `UPDATE indicadores SET unidad = $1, valor_meta = $2, tipo = $3, frecuencia = $4 WHERE id = $5`,
            [opts.unidad, opts.valorMeta, opts.tipo, opts.frecuencia, id],
          );
          return id;
        }
        const r = await client.query(
          `INSERT INTO indicadores (id, nombre, unidad, valor_meta, tipo, frecuencia)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`,
          [opts.nombre, opts.unidad, opts.valorMeta, opts.tipo, opts.frecuencia],
        );
        return r.rows[0].id as string;
      }
      const indRiego = await upsertIndicador({
        nombre: 'Predios con riego tecnificado S6',
        unidad: 'predios',
        valorMeta: 40,
        tipo: 'CUANTITATIVO',
        frecuencia: 'MENSUAL',
      });
      const indSat = await upsertIndicador({
        nombre: 'Satisfacción del productor S6',
        unidad: 'puntos',
        valorMeta: 5,
        tipo: 'CUALITATIVO',
        frecuencia: 'MENSUAL',
      });
      const indKits = await upsertIndicador({
        nombre: 'Kits productivos entregados S6',
        unidad: 'kits',
        valorMeta: 80,
        tipo: 'CUANTITATIVO',
        frecuencia: 'MENSUAL',
      });
      for (const [ind, pid] of [
        [indRiego, proyectoId],
        [indSat, proyectoId],
        [indKits, proyectoId],
        [indRiego, ambientalId],
      ] as const) {
        await client.query(
          `INSERT INTO indicador_proyectos (indicador_id, proyecto_id)
           SELECT $1, $2 WHERE NOT EXISTS (
             SELECT 1 FROM indicador_proyectos WHERE indicador_id = $1 AND proyecto_id = $2
           )`,
          [ind, pid],
        );
      }
      if (await tablaExiste('registros_indicador') && jornadasVolumen.length) {
        const valores = [
          { ind: indRiego, valor: 2, obs: 'Predios con manguera por goteo' },
          { ind: indSat, valor: 4.5, obs: 'Encuesta de salida positiva' },
          { ind: indKits, valor: 8, obs: 'Kits registrados en acta' },
          { ind: indRiego, valor: 1, obs: 'Nuevo sistema de riego' },
          { ind: indSat, valor: 4, obs: 'Satisfacción regular-alta' },
        ];
        for (let i = 0; i < valores.length; i++) {
          const jid = jornadasVolumen[i % jornadasVolumen.length].jornadaId;
          const tec = tecnicos[i % tecnicos.length];
          await client.query(
            `INSERT INTO registros_indicador (
               id, valor, registrado_en, observaciones, indicador_id, jornada_id, usuario_id
             ) VALUES (
               gen_random_uuid(), $1, $2, $3, $4, $5, $6
             )`,
            [
              valores[i].valor,
              diasOffset(-20 + i * 3, 15, 0).toISOString(),
              valores[i].obs,
              valores[i].ind,
              jid,
              tec.id,
            ],
          );
        }
      }
      console.log('✓ Indicadores y registros');
    }

    if (await tablaExiste('documentos_externos')) {
      const docs = [
        {
          titulo: 'Convenio de cooperación ASOCAFÉ',
          tipo: 'PDF',
          archivo: 'convenio-asocafe.pdf',
          mime: 'application/pdf',
          jornadaId: null as string | null,
          beneficiarioId: null as string | null,
          asociacionId: asociacionIds[0],
          actividadId: actividadId,
        },
        {
          titulo: 'Acta de constitución mujeres rurales',
          tipo: 'ACTA_TERCERO',
          archivo: 'acta-mujeres.docx',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          jornadaId: null,
          beneficiarioId: null,
          asociacionId: asociacionIds[1],
          actividadId: actividadCapId,
        },
        {
          titulo: 'Escaneo cédula María Pérez',
          tipo: 'ESCANEO',
          archivo: 'cc-maria-perez.jpg',
          mime: 'image/jpeg',
          jornadaId: null,
          beneficiarioId: beneficiarioId,
          asociacionId: null,
          actividadId: null,
        },
        {
          titulo: 'Listado de insumos entregados',
          tipo: 'EXCEL',
          archivo: 'insumos-entregados.xlsx',
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          jornadaId: j5.jornadaId,
          beneficiarioId: beneficiario2Id,
          asociacionId: null,
          actividadId: actividadId,
        },
        {
          titulo: 'Foto aérea parcela demostrativa',
          tipo: 'FOTO',
          archivo: 'parcela-aerea.jpg',
          mime: 'image/jpeg',
          jornadaId: j6.jornadaId,
          beneficiarioId: beneficiarioId,
          asociacionId: null,
          actividadId: actividadId,
        },
        {
          titulo: 'Resolución ambiental Sumapaz',
          tipo: 'PDF',
          archivo: 'resolucion-sumapaz.pdf',
          mime: 'application/pdf',
          jornadaId: null,
          beneficiarioId: null,
          asociacionId: asociacionIds[1],
          actividadId: planAmbiental.actividadId,
        },
      ];
      for (const d of docs) {
        await client.query(
          `INSERT INTO documentos_externos (
             id, titulo, descripcion, tipo, nombre_archivo, url_archivo, tipo_mime,
             tamano_archivo, proyecto_id, actividad_id, subactividad_id, jornada_id,
             beneficiario_id, asociacion_id, vereda_id, subido_por_id, creado_en
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, $6,
             $7, $8, $9, NULL, $10, $11, $12, $13, $14, NOW()
           )`,
          [
            d.titulo,
            `Documento de expediente ${MARCA}`,
            d.tipo,
            d.archivo,
            `https://placehold.co/600x400/pdf?text=${encodeURIComponent(d.titulo)}`,
            d.mime,
            128000 + Math.floor(Math.random() * 400000),
            d.titulo.includes('Sumapaz') ? ambientalId : proyectoId,
            d.actividadId,
            d.jornadaId,
            d.beneficiarioId,
            d.asociacionId,
            veredaA,
            admin.id,
          ],
        );
      }
      console.log('✓ Documentos externos del expediente');
    }

    await client.query(
      `INSERT INTO eventos_cronologia (
         id, actor_id, proyecto_id, accion, entidad_tipo, entidad_id,
         titulo, detalle, ocurrido_en
       ) VALUES (
         gen_random_uuid(), $1, $2, 'ACTIVIDAD_COMPLETADA', 'actividad', $3,
         $4, $5::jsonb, $6
       )`,
      [
        supervisor.id,
        proyectoId,
        actividadBaseId,
        'Completó la actividad Línea base y caracterización',
        JSON.stringify({ origen: 'seed_demo', seed_plataforma: true, marca: MARCA }),
        diasOffset(-40, 16, 0).toISOString(),
      ],
    );
    await client.query(
      `INSERT INTO eventos_cronologia (
         id, actor_id, proyecto_id, accion, entidad_tipo, entidad_id,
         titulo, detalle, ocurrido_en
       ) VALUES (
         gen_random_uuid(), $1, $2, 'SUBACTIVIDAD_COMPLETADA', 'subactividad', $3,
         $4, $5::jsonb, $6
       )`,
      [
        campo.id,
        proyectoId,
        subLineaBaseId,
        'Completó la subactividad Caracterización inicial',
        JSON.stringify({ origen: 'seed_demo', seed_plataforma: true, marca: MARCA }),
        diasOffset(-42, 11, 0).toISOString(),
      ],
    );

    await client.query('COMMIT');

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(' Seed plataforma listo');
    console.log('═══════════════════════════════════════════════════');
    console.log(` Proyecto principal: ${PROYECTO_NOMBRE}`);
    console.log(` URL jornadas: /proyectos/${proyectoId}?tab=jornadas`);
    console.log(` Bandeja:      /revision`);
    console.log(` Seguimiento:  /seguimiento`);
    console.log(` Evaluaciones: /evaluaciones`);
    console.log(` Contrapartes: /contrapartes`);
    console.log(` Dashboard:    /dashboard`);
    console.log('');
    console.log(' Credenciales (si Firebase OK) — contraseña: ' + PASSWORD);
    console.log(`   Cuantiva:     ${USUARIOS.cuantiva.correo}`);
    console.log(`   Admin:        ${USUARIOS.admin.correo}`);
    console.log(`   Coord. depto: ${USUARIOS.coordDepto.correo}`);
    console.log(`   Supervisor:   ${USUARIOS.supervisor.correo}`);
    console.log(`   Supervisor 2: ${USUARIOS.supervisor2.correo}`);
    console.log(`   Técnico:      ${USUARIOS.campo.correo}`);
    console.log(`   Técnica 2:    ${USUARIOS.campo2.correo}`);
    console.log(`   Técnico 3:    ${USUARIOS.campo3.correo}`);
    console.log(`   Visualizador: ${USUARIOS.visualizador.correo}`);
    console.log('');
    console.log(' Dataset:');
    console.log('   · 6 proyectos (activo, ambiental, turismo, cerrado, suspendido, borrador)');
    console.log('   · 14 beneficiarios y 4 asociaciones');
    console.log('   · Plan con varias actividades, metas y periodos');
    console.log('   · Jornadas de bandeja + histórico de 6 meses');
    console.log(' Qué ver en /revision (supervisor):');
    console.log('   · Pendientes     → María Pérez, taller grupal, Lucía 2.ª ronda');
    console.log('   · Rechazadas     → Visita Pedro Ramírez (foto borrosa)');
    console.log('   · En corrección  → Seguimiento riego (firma faltante)');
    console.log('   · Aprobadas      → Entrega de insumos y volumen histórico');
    console.log(' Qué ver (técnico):');
    console.log('   · Borradores / Sincronizado / Corrección / Rechazadas / Aprobadas');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    const pg = err as { message?: string; detail?: string; table?: string; constraint?: string };
    console.error(pg.detail || pg.message || err);
    if (pg.table || pg.constraint) {
      console.error(`  tabla=${pg.table ?? '?'} constraint=${pg.constraint ?? '?'}`);
    }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
