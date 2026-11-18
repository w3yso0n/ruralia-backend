import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { DataSource, In } from 'typeorm';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { CampoFormulario } from '../formularios/entities/campo-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { TipoCampo } from '../formularios/enums/tipo-campo.enum';
import { FaseFormulario } from '../formularios/enums/fase-formulario.enum';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ETIQUETA_ESTADO_LINEA_BASE } from './utils/estado-linea-base';
import { EstadoLineaBase } from './dto/linea-base.dto';

const LOTE = 1000;
const TIPOS_ARCHIVO = new Set<string>([
  TipoCampo.FOTO,
  TipoCampo.FIRMA,
  TipoCampo.ARCHIVO,
]);
const EXTENSION_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

interface FilaBase {
  beneficiarioId: string;
  estado: EstadoLineaBase;
  jornadaId: string | null;
  tecnico: string | null;
  enviadoEn: Date | null;
}

function partes<T>(lista: T[]): T[][] {
  const salida: T[][] = [];
  for (let i = 0; i < lista.length; i += LOTE)
    salida.push(lista.slice(i, i + LOTE));
  return salida;
}

function fechaTexto(valor: Date | string | null | undefined): string {
  if (!valor) return '';
  if (typeof valor === 'string') return valor.slice(0, 10);
  return Number.isNaN(valor.getTime()) ? '' : valor.toISOString().slice(0, 10);
}

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Excel de línea base de un proyecto, para análisis externo (no para volver
 * a cargarse): una fila por beneficiario activo del proyecto, con o sin
 * respuesta; datos base y territorio; una columna por pregunta del
 * formulario; estado, envío, técnico y coordenadas.
 */
@Injectable()
export class ExcelLineaBaseService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

  async generar(
    proyectoId: string,
    usuario: Usuario,
    urlBase: string,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    await this.alcanceTerritorialService.assertProyectoVisible(
      usuario,
      proyectoId,
    );
    const proyecto = await this.dataSource.getRepository(Proyecto).findOne({
      where: { id: proyectoId },
      relations: { plantillaLineaBase: true },
    });
    if (!proyecto)
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);

    const filas = await this.dataSource.query<FilaBase[]>(
      `WITH ultima AS (
         SELECT DISTINCT ON (jb.beneficiario_id)
           jb.beneficiario_id, j.id AS jornada_id, j.estado_funcional::text AS estado_funcional,
           j.tecnico_responsable_nombre AS tecnico
         FROM jornadas j
         INNER JOIN jornada_beneficiarios jb ON jb.jornada_id = j.id
         WHERE j.proyecto_id = $1 AND j.fase = '${FaseFormulario.LINEA_BASE}' AND j.estado <> 'CANCELADA'
         ORDER BY jb.beneficiario_id, j.creado_en DESC
       )
       SELECT pb.beneficiario_id AS "beneficiarioId",
         CASE
           WHEN u.jornada_id IS NULL THEN 'SIN_ASIGNAR'
           WHEN u.estado_funcional = 'APROBADO' THEN 'COMPLETA'
           WHEN u.estado_funcional IN ('RECHAZADO', 'EN_CORRECCION') THEN 'EN_CORRECCION'
           WHEN u.estado_funcional IN ('SINCRONIZADO', 'EN_REVISION') THEN 'ENVIADA'
           ELSE 'ASIGNADA'
         END AS estado,
         u.jornada_id AS "jornadaId", u.tecnico,
         (SELECT MAX(e.enviado_en) FROM envios_formulario e WHERE e.jornada_id = u.jornada_id) AS "enviadoEn"
       FROM proyecto_beneficiarios pb
       INNER JOIN beneficiarios b ON b.id = pb.beneficiario_id
       LEFT JOIN ultima u ON u.beneficiario_id = pb.beneficiario_id
       WHERE pb.proyecto_id = $1 AND pb.esta_activo_en_proyecto = true AND b.eliminado_en IS NULL
       ORDER BY b.apellidos, b.nombres`,
      [proyectoId],
    );

    const beneficiarioIds = filas.map((f) => f.beneficiarioId);
    const jornadaIds = filas
      .map((f) => f.jornadaId)
      .filter((id): id is string => !!id);

    // Cada colección en su propia consulta, por lotes y en paralelo.
    const [beneficiarios, jornadas, envios] = await Promise.all([
      Promise.all(
        partes(beneficiarioIds).map((ids) =>
          this.dataSource.getRepository(Beneficiario).find({
            where: { id: In(ids) },
            relations: {
              vereda: { municipio: { departamento: { region: true } } },
              veredaPdet: { municipio: { departamento: { region: true } } },
            },
          }),
        ),
      ).then((l) => l.flat()),
      Promise.all(
        partes(jornadaIds).map((ids) =>
          this.dataSource.query<
            Array<{
              id: string;
              latitud: string | null;
              longitud: string | null;
              plantillaId: string | null;
            }>
          >(
            `SELECT id, latitud, longitud, plantilla_formulario_id AS "plantillaId" FROM jornadas WHERE id = ANY($1::uuid[])`,
            [ids],
          ),
        ),
      ).then((l) => l.flat()),
      Promise.all(
        partes(jornadaIds).map((ids) =>
          this.dataSource.query<Array<{ id: string; jornadaId: string }>>(
            `SELECT DISTINCT ON (jornada_id) id, jornada_id AS "jornadaId"
             FROM envios_formulario WHERE jornada_id = ANY($1::uuid[])
             ORDER BY jornada_id, enviado_en DESC`,
            [ids],
          ),
        ),
      ).then((l) => l.flat()),
    ]);

    // Preguntas: las del formulario activo primero; luego las de formularios
    // anteriores que aún tengan jornadas (si el formulario cambió).
    const plantillaIds = [
      ...new Set(
        [
          proyecto.plantillaLineaBase?.id,
          ...jornadas.map((j) => j.plantillaId),
        ].filter((id): id is string => !!id),
      ),
    ];
    const [campos, respuestas] = await Promise.all([
      plantillaIds.length
        ? this.dataSource.getRepository(CampoFormulario).find({
            where: { plantillaFormulario: { id: In(plantillaIds) } },
            relations: { plantillaFormulario: true },
            order: { orden: 'ASC' },
          })
        : Promise.resolve([] as CampoFormulario[]),
      Promise.all(
        partes(envios.map((e) => e.id)).map((ids) =>
          this.dataSource.getRepository(RespuestaFormulario).find({
            where: { envioFormulario: { id: In(ids) } },
            relations: { envioFormulario: true },
          }),
        ),
      ).then((l) => l.flat()),
    ]);

    const activa = proyecto.plantillaLineaBase?.id;
    const columnasPregunta: Array<{
      clave: string;
      etiqueta: string;
      tipo: TipoCampo;
    }> = [];
    const vistas = new Set<string>();
    for (const campo of [
      ...campos.filter((c) => c.plantillaFormulario.id === activa),
      ...campos.filter((c) => c.plantillaFormulario.id !== activa),
    ]) {
      if (vistas.has(campo.clave)) continue;
      vistas.add(campo.clave);
      columnasPregunta.push({
        clave: campo.clave,
        etiqueta: campo.etiqueta,
        tipo: campo.tipoCampo,
      });
    }

    const porBeneficiario = new Map(beneficiarios.map((b) => [b.id, b]));
    const jornadaPorId = new Map(jornadas.map((j) => [j.id, j]));
    const envioPorJornada = new Map(envios.map((e) => [e.jornadaId, e.id]));
    const respuestasPorEnvio = new Map<
      string,
      Map<string, RespuestaFormulario>
    >();
    for (const r of respuestas) {
      const envioId = r.envioFormulario.id;
      if (!respuestasPorEnvio.has(envioId))
        respuestasPorEnvio.set(envioId, new Map());
      respuestasPorEnvio.get(envioId)!.set(r.claveCampo, r);
    }

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Ruralia';
    const hoja = libro.addWorksheet('Línea base', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    const encabezados = [
      'Nombres',
      'Apellidos',
      'Tipo de documento',
      'Número de documento',
      'Sexo',
      'Edad',
      'Fecha de nacimiento',
      'Teléfono',
      'Correo',
      'Asociación',
      'Región',
      'Departamento',
      'Municipio',
      'Vereda DANE',
      'Código vereda DANE',
      'Vereda PDET',
      'Código vereda PDET',
      'Línea productiva',
      ...columnasPregunta.map((c) => c.etiqueta),
      'Estado línea base',
      'Fecha de envío',
      'Técnico',
      'Latitud',
      'Longitud',
    ];
    const cabecera = hoja.addRow(encabezados);
    cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cabecera.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF42827A' },
    };

    for (const fila of filas) {
      const b = porBeneficiario.get(fila.beneficiarioId);
      const municipio =
        b?.vereda?.municipio ?? b?.veredaPdet?.municipio ?? null;
      const envioId = fila.jornadaId
        ? envioPorJornada.get(fila.jornadaId)
        : undefined;
      const resp = envioId ? respuestasPorEnvio.get(envioId) : undefined;
      const jornada = fila.jornadaId
        ? jornadaPorId.get(fila.jornadaId)
        : undefined;

      const valoresPreguntas: string[] = [];
      for (const col of columnasPregunta) {
        const r = resp?.get(col.clave);
        valoresPreguntas.push(
          r ? await this.textoRespuesta(col.tipo, r, proyectoId, urlBase) : '',
        );
      }

      hoja.addRow([
        b?.nombres ?? '',
        b?.apellidos ?? '',
        b?.tipoDocumento ?? '',
        b?.numeroDocumento ?? '',
        b?.genero ?? '',
        b?.edad ?? '',
        fechaTexto(b?.fechaNacimiento),
        b?.telefono ?? '',
        b?.correo ?? '',
        b?.nombreAsociacion ?? '',
        municipio?.departamento?.region?.nombre ?? '',
        municipio?.departamento?.nombre ?? '',
        municipio?.nombre ?? b?.municipio ?? '',
        b?.vereda?.nombre ?? '',
        b?.vereda?.codigo ?? '',
        b?.veredaPdet?.nombre ?? '',
        b?.veredaPdet?.codigo ?? '',
        b?.lineaProductiva ?? '',
        ...valoresPreguntas,
        ETIQUETA_ESTADO_LINEA_BASE[fila.estado],
        fila.enviadoEn
          ? new Date(fila.enviadoEn)
              .toISOString()
              .replace('T', ' ')
              .slice(0, 16)
          : '',
        fila.tecnico ?? '',
        jornada?.latitud != null ? Number(jornada.latitud) : '',
        jornada?.longitud != null ? Number(jornada.longitud) : '',
      ]);
    }

    hoja.columns.forEach((columna, i) => {
      columna.width = Math.min(
        Math.max((encabezados[i] ?? '').length + 2, 12),
        45,
      );
    });

    const buffer = Buffer.from(await libro.xlsx.writeBuffer());
    const fecha = new Date().toISOString().slice(0, 10);
    return {
      buffer,
      nombreArchivo: `linea-base-${slug(proyecto.nombre) || proyecto.id}-${fecha}.xlsx`,
    };
  }

  /** Texto de una respuesta para la celda. Múltiples unidas con "; "; archivos como URL. */
  private async textoRespuesta(
    tipo: TipoCampo,
    r: RespuestaFormulario,
    proyectoId: string,
    urlBase: string,
  ): Promise<string> {
    if (TIPOS_ARCHIVO.has(tipo) || r.urlArchivo) {
      return this.urlArchivo(r, proyectoId, urlBase);
    }
    switch (tipo) {
      case TipoCampo.NUMERO:
        return r.valorNumero != null ? String(Number(r.valorNumero)) : '';
      case TipoCampo.FECHA:
        return fechaTexto(r.valorFecha);
      case TipoCampo.SI_NO:
        return r.valorBooleano == null ? '' : r.valorBooleano ? 'Sí' : 'No';
      case TipoCampo.SELECCION_MULTIPLE: {
        const json = r.valorJson as unknown;
        const lista = Array.isArray(json)
          ? json
          : Array.isArray((json as { valor?: unknown })?.valor)
            ? (json as { valor: unknown[] }).valor
            : [];
        return lista.map(String).join('; ');
      }
      case TipoCampo.GPS: {
        const g = r.valorJson as { latitud?: number; longitud?: number } | null;
        return g?.latitud != null && g?.longitud != null
          ? `${g.latitud}, ${g.longitud}`
          : '';
      }
      case TipoCampo.VEREDA_PDET: {
        const v = r.valorJson as { nombre?: string; codigo?: string } | null;
        return v?.nombre
          ? `${v.nombre}${v.codigo ? ` (${v.codigo})` : ''}`
          : '';
      }
      case TipoCampo.TABLA: {
        const filas =
          (r.valorJson as { filas?: Array<Record<string, unknown>> } | null)
            ?.filas ?? [];
        return filas
          .map((f) =>
            Object.entries(f)
              .filter(([k]) => !k.startsWith('_'))
              .map(([k, v]) => `${k}: ${String(v ?? '')}`)
              .join(', '),
          )
          .join('; ');
      }
      default:
        return r.valorTexto ?? '';
    }
  }

  /**
   * Fotos y firmas llegan como data URL. Para que el Excel tenga un enlace
   * abrible se escriben una vez como archivo en la carpeta pública de
   * subidas (la misma que sirve las evidencias).
   */
  private async urlArchivo(
    r: RespuestaFormulario,
    proyectoId: string,
    urlBase: string,
  ): Promise<string> {
    const valor = r.urlArchivo ?? '';
    if (!valor) return '';
    if (/^https?:\/\//i.test(valor)) return valor;
    if (valor.startsWith('/')) return `${urlBase}${valor}`;
    const datos = /^data:([^;,]+);base64,(.+)$/s.exec(valor);
    if (!datos) return '';
    const extension = EXTENSION_MIME[datos[1].toLowerCase()] ?? 'bin';
    const raiz =
      process.env.RUTA_SUBIDAS || path.join(process.cwd(), 'subidas');
    const relativa = path.posix.join(
      'linea-base',
      proyectoId,
      `${r.id}.${extension}`,
    );
    const destino = path.join(raiz, relativa);
    if (!existsSync(destino)) {
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, Buffer.from(datos[2], 'base64'));
    }
    return `${urlBase}/subidas/${relativa}`;
  }
}
