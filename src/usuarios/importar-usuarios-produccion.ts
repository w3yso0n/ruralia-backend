/**
 * Importa los usuarios de usuarios_produccion_no_admin.xlsx.
 *
 * Idempotente: si el correo ya existe, no cambia la contraseña y solo
 * asegura el rol. Los perfiles que no son un rol de sistema se crean
 * con un único permiso: dashboard.ver.
 *
 * Uso: pnpm run importar:usuarios-produccion
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import ExcelJS from 'exceljs';
import { Client } from 'pg';
import { normalizarClavePrivadaFirebase } from '../autenticacion/normalizar-clave-privada';
import { RolSistema } from './catalogo-permisos';

const ARCHIVO_EXCEL = 'usuarios_produccion_no_admin.xlsx';
const PERMISO_MINIMO = 'dashboard.ver';

/** Etiquetas del Excel → nombre canónico del rol de sistema. */
const ALIAS_PERFIL_A_ROL: Record<string, RolSistema> = {
  'COORDINADOR DE ZONA': RolSistema.COORDINADOR_ZONA,
  'PROFESIONAL DE APOYO': RolSistema.PROFESIONAL_APOYO,
  TECNICO: RolSistema.CAMPO,
};

const ROLES_SISTEMA = new Set<string>(Object.values(RolSistema));

interface FilaUsuario {
  nombreCompleto: string;
  correo: string;
  contrasena: string;
  perfiles: string[];
}

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

function textoCelda(valor: ExcelJS.CellValue): string {
  if (valor == null) return '';
  if (typeof valor === 'string' || typeof valor === 'number') {
    return String(valor).trim();
  }
  if (typeof valor === 'object' && valor && 'text' in valor) {
    return String(valor.text ?? '').trim();
  }
  if (typeof valor === 'object' && valor && 'result' in valor) {
    return textoCelda(valor.result as ExcelJS.CellValue);
  }
  if (typeof valor === 'object' && valor && 'richText' in valor) {
    const partes = valor.richText as Array<{ text?: string }>;
    return partes.map((p) => p.text ?? '').join('').trim();
  }
  return String(valor).trim();
}

function normalizarPerfil(perfil: string): string {
  const limpio = perfil
    .trim()
    .replace(/^\[|\]$/g, '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (ALIAS_PERFIL_A_ROL[limpio]) return ALIAS_PERFIL_A_ROL[limpio];
  const snake = limpio.replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (ROLES_SISTEMA.has(snake)) return snake;
  return snake;
}

async function leerFilas(ruta: string): Promise<FilaUsuario[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const hoja = wb.worksheets[0];
  if (!hoja) throw new Error('El Excel no tiene hojas');

  const encabezado = hoja.getRow(1);
  const indice: Record<string, number> = {};
  encabezado.eachCell((celda, col) => {
    indice[textoCelda(celda.value).toLowerCase()] = col;
  });

  const colNombre = indice['nombre completo'];
  const colEmail = indice['email'];
  const colContrasena = indice['contraseña'] ?? indice['contrasena'];
  const colPerfil = indice['perfil(es)'] ?? indice['perfiles'] ?? indice['perfil'];
  if (!colNombre || !colEmail || !colContrasena || !colPerfil) {
    throw new Error(
      'El Excel debe tener columnas Nombre completo, Email, Contraseña y Perfil(es)',
    );
  }

  const filas: FilaUsuario[] = [];
  hoja.eachRow((fila, numero) => {
    if (numero === 1) return;
    const correo = textoCelda(fila.getCell(colEmail).value).toLowerCase();
    const nombreCompleto = textoCelda(fila.getCell(colNombre).value).replace(
      /\s+/g,
      ' ',
    );
    const contrasena = textoCelda(fila.getCell(colContrasena).value);
    const perfiles = textoCelda(fila.getCell(colPerfil).value)
      .split(/[,;|]/)
      .map((p) => normalizarPerfil(p))
      .filter(Boolean);
    if (!correo && !nombreCompleto) return;
    filas.push({ nombreCompleto, correo, contrasena, perfiles });
  });
  return filas;
}

function initFirebase(): void {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? normalizarClavePrivadaFirebase(process.env.FIREBASE_PRIVATE_KEY)
    : undefined;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY',
    );
  }
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
}

async function asegurarFirebase(
  correo: string,
  contrasena: string,
  nombreCompleto: string,
): Promise<{ uid: string; creado: boolean }> {
  const auth = getAuth();
  try {
    const existente = await auth.getUserByEmail(correo);
    if (existente.disabled) {
      await auth.updateUser(existente.uid, { disabled: false });
    }
    return { uid: existente.uid, creado: false };
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') {
      throw error;
    }
  }
  if (contrasena.length < 6) {
    throw new Error('La contraseña tiene menos de 6 caracteres');
  }
  const creado = await auth.createUser({
    email: correo,
    password: contrasena,
    displayName: nombreCompleto,
    emailVerified: true,
  });
  return { uid: creado.uid, creado: true };
}

async function main(): Promise<void> {
  cargarEnvLocal();
  const rutaExcel = resolve(
    process.cwd(),
    process.argv[2] || ARCHIVO_EXCEL,
  );
  if (!existsSync(rutaExcel)) {
    throw new Error(`No se encontró el Excel en ${rutaExcel}`);
  }

  const filas = await leerFilas(rutaExcel);
  initFirebase();

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ruralia',
  });
  await client.connect();

  const creados: string[] = [];
  const yaExistian: string[] = [];
  const errores: string[] = [];
  const rolesCreados: string[] = [];

  try {
    const permiso = await client.query(
      `SELECT id FROM permisos WHERE clave = $1 LIMIT 1`,
      [PERMISO_MINIMO],
    );
    const permisoId = permiso.rows[0]?.id as string | undefined;
    if (!permisoId) {
      throw new Error(`No existe el permiso ${PERMISO_MINIMO}. Arranca el backend una vez.`);
    }

    const cacheRoles = new Map<string, string>();

    async function idRol(nombre: string): Promise<string> {
      const cacheado = cacheRoles.get(nombre);
      if (cacheado) return cacheado;

      const existente = await client.query(
        `SELECT id FROM roles WHERE nombre = $1 LIMIT 1`,
        [nombre],
      );
      if (existente.rows[0]) {
        cacheRoles.set(nombre, existente.rows[0].id as string);
        return existente.rows[0].id as string;
      }

      if (ROLES_SISTEMA.has(nombre)) {
        throw new Error(
          `No existe el rol de sistema ${nombre}. Arranca el backend para sembrarlo.`,
        );
      }

      const insertado = await client.query(
        `INSERT INTO roles (nombre, descripcion, es_sistema, esta_activo)
         VALUES ($1, $2, false, true)
         RETURNING id`,
        [
          nombre,
          'Rol importado desde producción. Permiso mínimo: ver el panel de inicio.',
        ],
      );
      const rolId = insertado.rows[0].id as string;
      await client.query(
        `INSERT INTO rol_permisos (rol_id, permiso_id)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM rol_permisos WHERE rol_id = $1 AND permiso_id = $2
         )`,
        [rolId, permisoId],
      );
      cacheRoles.set(nombre, rolId);
      rolesCreados.push(nombre);
      console.log(`+ Rol ${nombre} (solo ${PERMISO_MINIMO})`);
      return rolId;
    }

    async function asegurarRolUsuario(
      usuarioId: string,
      rolId: string,
    ): Promise<void> {
      await client.query(
        `INSERT INTO usuario_roles (usuario_id, rol_id)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM usuario_roles WHERE usuario_id = $1 AND rol_id = $2
         )`,
        [usuarioId, rolId],
      );
    }

    for (const fila of filas) {
      if (!fila.correo || !fila.correo.includes('@')) {
        errores.push(`Fila sin correo válido: ${fila.nombreCompleto || '(sin nombre)'}`);
        continue;
      }
      if (!fila.nombreCompleto) {
        errores.push(`Fila sin nombre: ${fila.correo}`);
        continue;
      }
      if (fila.perfiles.length === 0) {
        errores.push(`Fila sin perfil: ${fila.correo}`);
        continue;
      }

      try {
        const rolIds: string[] = [];
        for (const perfil of fila.perfiles) {
          rolIds.push(await idRol(perfil));
        }

        const fb = await asegurarFirebase(
          fila.correo,
          fila.contrasena,
          fila.nombreCompleto,
        );

        const porCorreo = await client.query(
          `SELECT id, firebase_uid FROM usuarios WHERE lower(correo) = $1 LIMIT 1`,
          [fila.correo],
        );

        let usuarioId: string;
        if (porCorreo.rows[0]) {
          usuarioId = porCorreo.rows[0].id as string;
          if (porCorreo.rows[0].firebase_uid !== fb.uid) {
            await client.query(
              `UPDATE usuarios SET firebase_uid = $1 WHERE id = $2`,
              [fb.uid, usuarioId],
            );
          }
          yaExistian.push(fila.correo);
        } else {
          const insertado = await client.query(
            `INSERT INTO usuarios (id, firebase_uid, correo, nombre_completo, url_foto, esta_activo, creado_en)
             VALUES (uuid_generate_v4(), $1, $2, $3, NULL, true, NOW())
             RETURNING id`,
            [fb.uid, fila.correo, fila.nombreCompleto],
          );
          usuarioId = insertado.rows[0].id as string;
          creados.push(fila.correo);
        }

        for (const rolId of rolIds) {
          await asegurarRolUsuario(usuarioId, rolId);
        }
        console.log(
          `${porCorreo.rows[0] ? '=' : '+'} ${fila.nombreCompleto} <${fila.correo}> → ${fila.perfiles.join(', ')}`,
        );
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        errores.push(`${fila.correo}: ${mensaje}`);
        console.error(`! ${fila.correo}: ${mensaje}`);
      }
    }
  } finally {
    await client.end();
  }

  console.log('');
  console.log(`Roles creados: ${rolesCreados.length} (${rolesCreados.join(', ') || 'ninguno'})`);
  console.log(`Usuarios creados: ${creados.length}`);
  console.log(`Usuarios que ya existían: ${yaExistian.length}`);
  console.log(`Errores: ${errores.length}`);
  if (errores.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
