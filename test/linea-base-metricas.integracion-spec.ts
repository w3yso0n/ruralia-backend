/**
 * Prueba de integración: crear, enviar y aprobar jornadas de línea base no
 * cambia ninguna métrica de ejecución (avance, Gantt, dashboard, reportes,
 * evaluaciones, expediente) y sí actualiza al beneficiario con historial.
 *
 * Corre contra una base de datos aparte (por defecto `ruralia_test`), nunca
 * contra la del `.env`: el synchronize y el seed escriben en ella. Se niega a
 * correr si el nombre no termina en `_test` o si el host no es local.
 *
 *   pnpm test:integracion
 *   DB_DATABASE_TEST=otra_test pnpm test:integracion
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';

const RAIZ = resolve(__dirname, '..');

function cargarEnv(): void {
  const ruta = resolve(RAIZ, '.env');
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const clave = t.slice(0, eq).trim();
    const valor = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

const BASE = process.env.DB_DATABASE_TEST ?? 'ruralia_test';
cargarEnv();
const HOST = process.env.DB_HOST ?? 'localhost';
if (!BASE.endsWith('_test')) {
  throw new Error(
    `La base de pruebas debe terminar en _test (recibido: ${BASE})`,
  );
}
if (!['localhost', '127.0.0.1', '::1'].includes(HOST)) {
  throw new Error(
    `Las pruebas de integración solo corren contra un Postgres local (DB_HOST=${HOST})`,
  );
}
// Antes de importar AppModule: lee estas variables al cargarse.
process.env.DB_DATABASE = BASE;
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '1'; // sin Redis: procesamiento síncrono
process.env.FIREBASE_PROJECT_ID = '';
process.env.FIREBASE_CLIENT_EMAIL = '';
process.env.FIREBASE_PRIVATE_KEY = '';
process.env.FIREBASE_PRIVATE_KEY_BASE64 = '';

const clienteAdmin = () =>
  new Client({
    host: HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres',
  });

async function asegurarBase(): Promise<void> {
  const c = clienteAdmin();
  await c.connect();
  try {
    const existe = await c.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [BASE],
    );
    if (!existe.rowCount) await c.query(`CREATE DATABASE "${BASE}"`);
  } finally {
    await c.end();
  }
}

/** Quita campos que cambian con el reloj, no con los datos. */
function normalizar(valor: unknown): unknown {
  return JSON.parse(
    JSON.stringify(valor, (clave, v: unknown) =>
      ['generadoEn', 'actualizadoEn', 'ahora'].includes(clave) ? undefined : v,
    ),
  );
}

describe('Línea base fuera de las métricas de ejecución', () => {
  let app: INestApplication;
  // Servicios y entidades se cargan después de fijar el entorno.
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
  let s: Record<string, any>;
  let ds: any;
  let admin: any;
  let tecnico: any;
  let proyectoId: string;

  beforeAll(async () => {
    await asegurarBase();

    const { Test } = require('@nestjs/testing');
    const { AppModule } = require('../src/app.module');
    const { ColaModule } = require('../src/cola/cola.module');
    const {
      FirebaseAdminService,
    } = require('../src/autenticacion/firebase-admin.service');

    const moduloRef = await Test.createTestingModule({
      imports: [AppModule.register(await ColaModule.forRoot())],
    })
      .overrideProvider(FirebaseAdminService)
      .useValue({ onModuleInit: () => undefined })
      .compile();
    app = moduloRef.createNestApplication({ logger: ['error'] });
    await app.init();

    // Datos de ejecución realistas (plan, metas, jornadas aprobadas, envíos).
    execFileSync(
      'npx',
      [
        'ts-node',
        '-r',
        'tsconfig-paths/register',
        'src/seeds/seed-plataforma.ts',
      ],
      { cwd: RAIZ, env: { ...process.env }, stdio: 'pipe' },
    );

    const { DataSource } = require('typeorm');
    ds = app.get(DataSource);
    s = {
      actividades: app.get(
        require('../src/actividades/actividades.service').ActividadesService,
      ),
      proyectos: app.get(
        require('../src/proyectos/proyectos.service').ProyectosService,
      ),
      dashboard: app.get(
        require('../src/dashboard/dashboard.service').DashboardService,
      ),
      reportes: app.get(
        require('../src/reportes/reportes.service').ReportesService,
      ),
      evaluaciones: app.get(
        require('../src/evaluaciones/evaluaciones.service').EvaluacionesService,
      ),
      expediente: app.get(
        require('../src/documentos-externos/expediente.service')
          .ExpedienteService,
      ),
      jornadas: app.get(
        require('../src/jornadas/jornadas.service').JornadasService,
      ),
      plantillas: app.get(
        require('../src/formularios/plantillas-formulario.service')
          .PlantillasFormularioService,
      ),
      autocompletado: app.get(
        require('../src/formularios/autocompletado-formulario.service')
          .AutocompletadoFormularioService,
      ),
      envios: app.get(
        require('../src/formularios/envios-formulario.service')
          .EnviosFormularioService,
      ),
      aprobaciones: app.get(
        require('../src/aprobaciones/aprobaciones.service').AprobacionesService,
      ),
      lineaBase: app.get(
        require('../src/linea-base/linea-base.service').LineaBaseService,
      ),
      veredasPdet: app.get(
        require('../src/territorios/veredas-pdet.service').VeredasPdetService,
      ),
    };

    const [proyecto] = await ds.query(
      `SELECT id FROM proyectos WHERE nombre = 'Proyecto Semilla Ruralia S6'`,
    );
    proyectoId = proyecto.id;
    const cargarUsuario = (where: string, params: unknown[]) =>
      ds
        .query(`SELECT u.id FROM usuarios u ${where} LIMIT 1`, params)
        .then(([fila]: Array<{ id: string }>) =>
          ds.getRepository('Usuario').findOne({
            where: { id: fila.id },
            relations: { roles: { permisos: true } },
          }),
        );
    admin = await cargarUsuario(`WHERE u.correo = $1`, [
      'admin.seed@ruralia.local',
    ]);
    tecnico = await cargarUsuario(
      `JOIN usuario_roles ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id AND r.nombre = 'CAMPO'
       JOIN proyecto_personal pp ON pp.usuario_id = u.id AND pp.proyecto_id = $1`,
      [proyectoId],
    );
    // Aprobación simple (sin niveles) para poder aprobar con el administrador.
    await ds.query(
      'DELETE FROM niveles_aprobacion_proyecto WHERE proyecto_id = $1',
      [proyectoId],
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  async function metricas() {
    const ahora = new Date();
    const filtrosMes = { anio: ahora.getFullYear(), mes: ahora.getMonth() + 1 };
    const ejecucion = await s.jornadas.listar(
      { proyectoId, limite: 100 },
      admin,
    );
    const expediente = await s.expediente.obtenerExpediente(proyectoId);
    return normalizar({
      progreso: await s.actividades.obtenerProgreso(proyectoId),
      progresoLote: [
        ...(
          await s.actividades.obtenerProgresoPorProyectos([proyectoId])
        ).entries(),
      ],
      resumen: await s.proyectos.obtenerResumen(proyectoId),
      estadisticas: await s.proyectos.obtenerEstadisticas(proyectoId),
      dashboardProyecto: await s.dashboard.obtenerCompleto(
        6,
        proyectoId,
        admin,
      ),
      dashboardGlobal: await s.dashboard.obtenerCompleto(6, undefined, admin),
      reporteResumen: await s.reportes.resumenProyecto(proyectoId),
      reporteAvance: await s.reportes.avanceActividades(proyectoId),
      reporteBeneficiarios: await s.reportes.reporteBeneficiarios(
        proyectoId,
        {},
      ),
      reporteMapaCalor: await s.reportes.mapaCalorTerritorio(proyectoId),
      productividad: await s.evaluaciones.productividadProyecto(
        proyectoId,
        filtrosMes,
        admin,
      ),
      equipoGlobal: await s.evaluaciones.cumplimientoEquipoGlobal(
        filtrosMes.anio,
        filtrosMes.mes,
        50,
        null,
        admin,
      ),
      expediente: {
        totales: expediente.totales,
        documentos: expediente.documentosGenerados
          .map((d: { id: string }) => d.id)
          .sort(),
        formularios: expediente.formularios
          .map((f: { id: string }) => f.id)
          .sort(),
      },
      jornadasEjecucion: {
        total: ejecucion.total,
        ids: ejecucion.datos.map((j: { id: string }) => j.id).sort(),
      },
    });
  }

  it('crear, enviar y aprobar línea base no cambia ninguna métrica', async () => {
    const antes = await metricas();
    // La prueba solo vale si hay ejecución que medir.
    expect((antes as any).estadisticas.conteoJornadas).toBeGreaterThan(0);

    // Formulario de línea base con preguntas vinculadas y una libre.
    const datoArea = await s.autocompletado.crearDatoAdicional(
      'Área de la finca prueba',
      'numero',
    );
    const [municipio] = await ds.query(`SELECT id FROM municipios LIMIT 1`);
    const veredaPdet = await s.veredasPdet.crear({
      municipioId: municipio.id,
      codigo: `PRUEBA-${Date.now()}`,
      nombre: 'Vereda PDET de prueba',
    });
    const plantilla = await s.plantillas.crear({
      nombre: `Línea base prueba ${Date.now()}`,
      fase: 'LINEA_BASE',
      tipoPlantilla: 'INDIVIDUAL',
      campos: [
        {
          etiqueta: 'Teléfono',
          clave: 'telefono',
          tipoCampo: 'TEXTO',
          vincularBeneficiario: { destino: 'beneficiario.telefono' },
        },
        {
          etiqueta: 'Área de la finca',
          clave: 'area',
          tipoCampo: 'NUMERO',
          vincularBeneficiario: { destino: datoArea.destino },
        },
        {
          etiqueta: 'Vereda PDET',
          clave: 'vpdet',
          tipoCampo: 'VEREDA_PDET',
          vincularBeneficiario: { destino: 'beneficiario.veredaPdet' },
        },
        { etiqueta: 'Observación libre', clave: 'obs', tipoCampo: 'TEXTO' },
      ],
    });
    await s.plantillas.publicar(plantilla.id);
    await s.lineaBase.configurar(
      proyectoId,
      { plantillaFormularioId: plantilla.id },
      admin,
    );

    // Dos beneficiarios del proyecto; al primero se le quita el teléfono para ver la escritura.
    const beneficiarios: Array<{ id: string }> = await ds.query(
      `SELECT pb.beneficiario_id AS id FROM proyecto_beneficiarios pb
       WHERE pb.proyecto_id = $1 AND pb.esta_activo_en_proyecto ORDER BY pb.creado_en LIMIT 2`,
      [proyectoId],
    );
    expect(beneficiarios).toHaveLength(2);
    await ds.query(`UPDATE beneficiarios SET telefono = NULL WHERE id = $1`, [
      beneficiarios[0].id,
    ]);

    const asignacion = await s.lineaBase.asignar(
      proyectoId,
      {
        beneficiarioIds: beneficiarios.map((b) => b.id),
        tecnicoId: tecnico.id,
      },
      admin,
    );
    expect(asignacion.creadas).toBe(2);

    // Una segunda asignación a los mismos se rechaza (una línea base activa por persona).
    await expect(
      s.lineaBase.asignar(
        proyectoId,
        { beneficiarioIds: [beneficiarios[0].id], tecnicoId: tecnico.id },
        admin,
      ),
    ).rejects.toThrow(/Ya tienen línea base/);

    const [jornadaA, jornadaB] = await Promise.all(
      asignacion.jornadaIds.map((id: string) =>
        ds
          .query(
            `SELECT j.id, jb.beneficiario_id FROM jornadas j JOIN jornada_beneficiarios jb ON jb.jornada_id = j.id WHERE j.id = $1`,
            [id],
          )
          .then((f: unknown[]) => f[0]),
      ),
    );
    const porBeneficiario = [jornadaA, jornadaB].find(
      (j: any) => j.beneficiario_id === beneficiarios[0].id,
    );
    const otra = [jornadaA, jornadaB].find((j: any) => j !== porBeneficiario);

    for (const jornada of [porBeneficiario, otra]) {
      await s.envios.enviar(
        {
          jornadaId: jornada.id,
          plantillaFormularioId: plantilla.id,
          beneficiarioId: jornada.beneficiario_id,
          respuestas: [
            { claveCampo: 'telefono', valor: '3009998877' },
            { claveCampo: 'area', valor: 4.5 },
            {
              claveCampo: 'vpdet',
              valor: { veredaPdetId: veredaPdet.id, nombre: veredaPdet.nombre },
            },
            { claveCampo: 'obs', valor: 'Sin novedad' },
          ],
        },
        tecnico,
      );
      await s.aprobaciones.enviarARevision(jornada.id, tecnico);
    }
    // Solo una se aprueba; la otra queda en revisión.
    await s.aprobaciones.aprobar(
      { entityType: 'JORNADA', entityId: porBeneficiario.id },
      admin,
    );

    const despues = await metricas();
    expect(despues).toEqual(antes);

    // El beneficiario se actualizó y quedó el historial con el valor anterior.
    const [beneficiario] = await ds.query(
      `SELECT telefono, datos_adicionales, vereda_pdet_id FROM beneficiarios WHERE id = $1`,
      [beneficiarios[0].id],
    );
    expect(beneficiario.telefono).toBe('3009998877');
    expect(beneficiario.vereda_pdet_id).toBe(veredaPdet.id);
    expect(
      beneficiario.datos_adicionales[
        datoArea.destino.replace('beneficiario.extra.', '')
      ],
    ).toBe(4.5);
    const historial = await ds.query(
      `SELECT campo, valor_anterior, valor_nuevo FROM historial_datos_beneficiario WHERE jornada_id = $1 ORDER BY campo`,
      [porBeneficiario.id],
    );
    expect(historial.map((h: { campo: string }) => h.campo).sort()).toEqual(
      [
        'beneficiario.telefono',
        'beneficiario.veredaPdet',
        datoArea.destino,
      ].sort(),
    );
    expect(
      historial.find((h: any) => h.campo === 'beneficiario.telefono')
        .valor_anterior,
    ).toBeNull();

    // La pendiente de revisión no escribió nada todavía.
    const pendientes = await ds.query(
      `SELECT 1 FROM historial_datos_beneficiario WHERE jornada_id = $1`,
      [otra.id],
    );
    expect(pendientes).toHaveLength(0);

    // Versiones sin PDF y estado de línea base.
    const versiones = await ds.query(
      `SELECT dv.file_path FROM document_versions dv JOIN documents d ON d.id = dv.document_id WHERE d.jornada_id = ANY($1::uuid[])`,
      [asignacion.jornadaIds],
    );
    expect(versiones.length).toBeGreaterThan(0);
    expect(
      versiones.every(
        (v: { file_path: string | null }) => v.file_path === null,
      ),
    ).toBe(true);
    const resumen = await s.lineaBase.resumen(proyectoId);
    expect(resumen.completa).toBe(1);
    expect(resumen.enviada).toBe(1);

    // La bandeja filtra por tipo.
    const bandeja = await s.aprobaciones.bandeja(admin, {
      proyectoId,
      fase: 'LINEA_BASE',
      vista: 'coordinacion',
    });
    expect(
      bandeja.items.every((i: { fase: string }) => i.fase === 'LINEA_BASE'),
    ).toBe(true);
  });

  it('un formulario de línea base no se puede usar en jornadas de ejecución', async () => {
    const [plantilla] = await ds.query(
      `SELECT id FROM plantillas_formulario WHERE fase = 'LINEA_BASE' AND esta_activo LIMIT 1`,
    );
    const [meta] = await ds.query(
      `SELECT m.id FROM metas m JOIN procesos p ON p.id = m.proceso_id JOIN subactividades sa ON sa.id = p.subactividad_id
       JOIN actividades a ON a.id = sa.actividad_id WHERE a.proyecto_id = $1 LIMIT 1`,
      [proyectoId],
    );
    await expect(
      s.jornadas.crear(
        {
          proyectoId,
          metaId: meta.id,
          plantillaFormularioId: plantilla.id,
          fecha: new Date().toISOString().slice(0, 10),
          tecnicoResponsableIds: [tecnico.id],
        },
        admin,
      ),
    ).rejects.toThrow(/línea base/);
  });
});
