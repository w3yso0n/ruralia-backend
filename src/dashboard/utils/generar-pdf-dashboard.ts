import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import {
  CumplimientoDashboardDto,
  JornadaRecienteDashboardDto,
  ProgresoProyectoDashboardDto,
  ProyectoRecienteDashboardDto,
  ResumenDashboardDto,
  SerieMensualDashboardDto,
  VeredaCoberturaDto,
} from '../dto/respuesta-dashboard.dto';

export interface AgentePdfDashboard {
  puesto: number;
  nombreCompleto: string;
  indiceEficiencia: number;
  cumplimientoPorcentaje: number;
  conteoJornadas: number;
  proyectoNombre?: string | null;
}

export interface DatosPdfDashboard {
  generadoEn: Date;
  generadoPor?: string | null;
  proyectoNombre?: string | null;
  proyectoEstado?: string | null;
  kpis: ResumenDashboardDto;
  medidores: CumplimientoDashboardDto;
  actividadMensual: SerieMensualDashboardDto[];
  progresoProyectos: ProgresoProyectoDashboardDto[];
  veredasCobertura: VeredaCoberturaDto[];
  jornadasRecientes: JornadaRecienteDashboardDto[];
  agentes: AgentePdfDashboard[];
}

const COLOR_BORDE = '#d4ddd9';
const COLOR_ENCABEZADO = '#eef3f2';
const COLOR_TEXTO = '#121c2d';
const COLOR_SECUNDARIO = '#5b6b7a';
const COLOR_MARCA = '#42827a';
const COLOR_MARCA_OSCURO = '#2d524d';
const COLOR_MARCA_SUAVE = '#eef3f2';
const COLOR_FONDO_SUAVE = '#f7f9f8';
const COLOR_BARRA_2 = '#7aa8a2';

function formatearFechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function etiquetaEstado(estado?: string | null): string {
  switch (estado) {
    case 'ACTIVO':
      return 'Activo';
    case 'BORRADOR':
      return 'Borrador';
    case 'SUSPENDIDO':
      return 'Suspendido';
    case 'COMPLETADO':
      return 'Completado';
    default:
      return estado ?? '';
  }
}

function cargarLogoRuralia(): Buffer | null {
  const candidatos = [
    join(process.cwd(), 'assets', 'logo-ruralia.png'),
    join(__dirname, '..', '..', '..', 'assets', 'logo-ruralia.png'),
    join(__dirname, '..', '..', '..', '..', 'assets', 'logo-ruralia.png'),
  ];
  for (const ruta of candidatos) {
    if (existsSync(ruta)) {
      try {
        return readFileSync(ruta);
      } catch {
        // seguir buscando
      }
    }
  }
  return null;
}

function dibujarRectRedondeado(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  opciones: { relleno?: string; borde?: string; grosor?: number },
) {
  doc.save();
  if (opciones.relleno) {
    doc.roundedRect(x, y, w, h, r).fill(opciones.relleno);
  }
  if (opciones.borde) {
    doc
      .lineWidth(opciones.grosor ?? 0.8)
      .strokeColor(opciones.borde)
      .roundedRect(x, y, w, h, r)
      .stroke();
  }
  doc.restore();
}

function dibujarCelda(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  relleno?: string,
) {
  if (relleno) {
    doc.save();
    doc.rect(x, y, w, h).fill(relleno);
    doc.restore();
  }
  doc.strokeColor(COLOR_BORDE).lineWidth(0.7).rect(x, y, w, h).stroke();
}

function asegurarEspacio(
  doc: PDFKit.PDFDocument,
  y: number,
  necesario: number,
  margenSup: number,
  margenInf: number,
): number {
  if (doc.page.height - margenInf - y >= necesario) return y;
  doc.addPage();
  doc.save();
  doc.rect(0, 0, doc.page.width, 8).fill(COLOR_MARCA);
  doc.restore();
  return margenSup;
}

function dibujarTituloSeccion(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  ancho: number,
  titulo: string,
): number {
  doc.save();
  doc.rect(x, y + 2, 3, 12).fill(COLOR_MARCA);
  doc.restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLOR_MARCA_OSCURO)
    .text(titulo.toUpperCase(), x + 10, y, { width: ancho - 10 });
  return doc.y + 8;
}

function dibujarMedidor(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  radio: number,
  porcentaje: number,
  color: string,
) {
  const pct = Math.min(100, Math.max(0, porcentaje));
  doc.save();
  doc.lineWidth(7).strokeColor('#e4e4e7');
  doc.circle(cx, cy, radio).stroke();
  if (pct > 0) {
    const inicio = -Math.PI / 2;
    const fin = inicio + (2 * Math.PI * pct) / 100;
    const sx = cx + radio * Math.cos(inicio);
    const sy = cy + radio * Math.sin(inicio);
    const ex = cx + radio * Math.cos(fin);
    const ey = cy + radio * Math.sin(fin);
    const largeArc = fin - inicio > Math.PI ? 1 : 0;
    doc
      .lineCap('round')
      .lineWidth(7)
      .strokeColor(color)
      .path(
        `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${radio} ${radio} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`,
      )
      .stroke();
  }
  doc.restore();
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLOR_TEXTO)
    .text(`${Math.round(pct)}%`, cx - 18, cy - 7, {
      width: 36,
      align: 'center',
    });
}

export function generarPdfReporteDashboard(
  datos: DatosPdfDashboard,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 40,
      layout: 'portrait',
      bufferPages: true,
      info: {
        Title: datos.proyectoNombre
          ? `Reporte operativo — ${datos.proyectoNombre}`
          : 'Reporte operativo — Todos los proyectos',
        Author: 'Ruralia',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margenIzq = doc.page.margins.left;
    const margenDer = doc.page.margins.right;
    const margenSup = doc.page.margins.top;
    const margenInf = doc.page.margins.bottom + 16;
    const anchoUtil = doc.page.width - margenIzq - margenDer;
    const x0 = margenIzq;
    const logo = cargarLogoRuralia();

    const altoFranja = 8;
    const paddingMarca = 10;
    const altoLogo = 40;
    const yLogo = altoFranja + paddingMarca;
    const altoBloqueMarca = paddingMarca + altoLogo + paddingMarca;

    doc.save();
    doc.rect(0, 0, doc.page.width, altoFranja).fill(COLOR_MARCA);
    doc
      .rect(0, altoFranja, doc.page.width, altoBloqueMarca)
      .fill(COLOR_MARCA_SUAVE);
    doc.restore();

    if (logo) {
      try {
        doc.image(logo, x0, yLogo, {
          fit: [40, altoLogo],
          align: 'center',
          valign: 'center',
        });
      } catch {
        // sin logo
      }
    } else {
      dibujarRectRedondeado(doc, x0, yLogo, 40, altoLogo, 6, {
        relleno: '#ffffff',
        borde: COLOR_MARCA,
        grosor: 1.2,
      });
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(COLOR_MARCA)
        .text('R', x0, yLogo + 10, { width: 40, align: 'center' });
    }

    const xMarca = x0 + 52;
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(COLOR_MARCA_OSCURO)
      .text('RURALIA', xMarca, yLogo, {
        width: anchoUtil - 62,
        lineBreak: false,
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_SECUNDARIO)
      .text('Gestión de proyectos territoriales', xMarca, yLogo + 18, {
        width: anchoUtil - 62,
        lineBreak: false,
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(COLOR_MARCA)
      .text('DOCUMENTO INSTITUCIONAL', xMarca, yLogo + 30, {
        width: anchoUtil - 62,
        lineBreak: false,
      });

    let y = altoFranja + altoBloqueMarca;
    doc
      .strokeColor(COLOR_MARCA)
      .lineWidth(2)
      .moveTo(x0, y)
      .lineTo(x0 + anchoUtil, y)
      .stroke();
    y += 16;

    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(COLOR_TEXTO)
      .text('REPORTE OPERATIVO DE DASHBOARD', x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 4;

    const alcance = datos.proyectoNombre
      ? `${datos.proyectoNombre}${
          datos.proyectoEstado
            ? ` · ${etiquetaEstado(datos.proyectoEstado)}`
            : ''
        }`
      : 'Todos los proyectos';

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLOR_MARCA_OSCURO)
      .text(alcance, x0, y, { width: anchoUtil, align: 'center' });
    y = doc.y + 2;

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_SECUNDARIO)
      .text(`Generado el ${formatearFechaLarga(datos.generadoEn)}`, x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 14;

    y = dibujarTituloSeccion(doc, x0, y, anchoUtil, 'Indicadores clave');

    const kpis: Array<{ etiqueta: string; valor: string }> = [
      {
        etiqueta: datos.proyectoNombre ? 'En ejecución' : 'Proyectos activos',
        valor: String(datos.kpis.proyectosActivos),
      },
      {
        etiqueta: datos.proyectoNombre ? 'Proyectos en vista' : 'Total proyectos',
        valor: String(datos.kpis.totalProyectos),
      },
      {
        etiqueta: 'Jornadas de campo',
        valor: String(datos.kpis.jornadasRegistradas),
      },
      {
        etiqueta: 'Agentes en campo',
        valor: String(datos.kpis.agentesEnCampo),
      },
    ];

    const gapKpi = 10;
    const anchoKpi = (anchoUtil - gapKpi * 3) / 4;
    const altoKpi = 46;
    kpis.forEach((item, idx) => {
      const x = x0 + idx * (anchoKpi + gapKpi);
      dibujarRectRedondeado(doc, x, y, anchoKpi, altoKpi, 6, {
        relleno: COLOR_FONDO_SUAVE,
        borde: COLOR_BORDE,
      });
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(COLOR_SECUNDARIO)
        .text(item.etiqueta.toUpperCase(), x + 8, y + 8, {
          width: anchoKpi - 16,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(COLOR_TEXTO)
        .text(item.valor, x + 8, y + 22, {
          width: anchoKpi - 16,
          lineBreak: false,
        });
    });
    y += altoKpi + 18;

    y = asegurarEspacio(doc, y, 130, margenSup, margenInf);
    y = dibujarTituloSeccion(doc, x0, y, anchoUtil, 'Cumplimiento operativo');

    const medidores: Array<{
      etiqueta: string;
      valor: number;
      esPorcentaje: boolean;
      color: string;
    }> = [
      {
        etiqueta: 'Avance del plan',
        valor: datos.medidores.cumplimientoPlan,
        esPorcentaje: true,
        color: COLOR_MARCA,
      },
      {
        etiqueta: 'Cobertura territorial',
        valor: datos.medidores.coberturaTerritorial,
        esPorcentaje: true,
        color: '#0d9488',
      },
      {
        etiqueta: 'Jornadas con evidencia',
        valor: datos.medidores.jornadasConEvidencia,
        esPorcentaje: true,
        color: '#356960',
      },
      {
        etiqueta: 'Jornadas del mes',
        valor: datos.medidores.jornadasMesActual,
        esPorcentaje: false,
        color: COLOR_MARCA,
      },
    ];

    const anchoMed = (anchoUtil - gapKpi * 3) / 4;
    const altoMed = 108;
    medidores.forEach((m, idx) => {
      const x = x0 + idx * (anchoMed + gapKpi);
      dibujarRectRedondeado(doc, x, y, anchoMed, altoMed, 8, {
        relleno: '#ffffff',
        borde: COLOR_BORDE,
      });
      const cx = x + anchoMed / 2;
      const cy = y + 42;
      if (m.esPorcentaje) {
        dibujarMedidor(doc, cx, cy, 22, m.valor, m.color);
      } else {
        doc.save();
        doc.circle(cx, cy, 26).fill(COLOR_MARCA_SUAVE);
        doc.restore();
        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor(COLOR_MARCA_OSCURO)
          .text(String(m.valor), cx - 24, cy - 8, {
            width: 48,
            align: 'center',
          });
      }
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR_TEXTO)
        .text(m.etiqueta, x + 6, y + 78, {
          width: anchoMed - 12,
          align: 'center',
        });
    });
    y += altoMed + 18;

    y = asegurarEspacio(doc, y, 170, margenSup, margenInf);
    y = dibujarTituloSeccion(doc, x0, y, anchoUtil, 'Actividad mensual');

    const serie = datos.actividadMensual;
    const altoGraf = 118;
    dibujarRectRedondeado(doc, x0, y, anchoUtil, altoGraf + 28, 8, {
      relleno: '#ffffff',
      borde: COLOR_BORDE,
    });

    const maxSerie = Math.max(
      ...serie.map((s) => Math.max(s.jornadas, s.formularios)),
      1,
    );
    const padGraf = 16;
    const anchoGraf = anchoUtil - padGraf * 2;
    const grupo = serie.length > 0 ? anchoGraf / serie.length : anchoGraf;
    const baseY = y + altoGraf - 8;

    serie.forEach((punto, i) => {
      const gx = x0 + padGraf + i * grupo + grupo * 0.2;
      const wBar = Math.max(6, grupo * 0.22);
      const hJ = (punto.jornadas / maxSerie) * (altoGraf - 36);
      const hF = (punto.formularios / maxSerie) * (altoGraf - 36);
      doc.save();
      doc.rect(gx, baseY - hJ, wBar, hJ).fill(COLOR_MARCA);
      doc.rect(gx + wBar + 3, baseY - hF, wBar, hF).fill(COLOR_BARRA_2);
      doc.restore();
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(COLOR_SECUNDARIO)
        .text(punto.mes, gx - 4, baseY + 4, {
          width: wBar * 2 + 10,
          align: 'center',
        });
    });

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOR_SECUNDARIO)
      .text('■ Jornadas    ■ Formularios', x0, y + altoGraf + 10, {
        width: anchoUtil,
        align: 'center',
      });
    y += altoGraf + 36;

    y = asegurarEspacio(doc, y, 80, margenSup, margenInf);
    y = dibujarTituloSeccion(
      doc,
      x0,
      y,
      anchoUtil,
      datos.proyectoNombre ? 'Avance del plan' : 'Progreso por proyecto',
    );

    const progresos = datos.progresoProyectos.slice(0, 10);
    if (progresos.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOR_SECUNDARIO)
        .text('Sin proyectos para mostrar.', x0, y);
      y = doc.y + 12;
    } else {
      for (const p of progresos) {
        y = asegurarEspacio(doc, y, 32, margenSup, margenInf);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(COLOR_TEXTO)
          .text(p.nombre, x0, y, { width: anchoUtil - 48, lineBreak: false });
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(COLOR_MARCA_OSCURO)
          .text(`${p.progresoPorcentaje}%`, x0 + anchoUtil - 44, y, {
            width: 44,
            align: 'right',
          });
        y += 12;
        dibujarRectRedondeado(doc, x0, y, anchoUtil, 8, 4, {
          relleno: '#eef1f0',
        });
        const anchoBarra = Math.max(
          0,
          (Math.min(100, p.progresoPorcentaje) / 100) * anchoUtil,
        );
        if (anchoBarra > 0) {
          dibujarRectRedondeado(doc, x0, y, anchoBarra, 8, 4, {
            relleno: COLOR_MARCA,
          });
        }
        y += 16;
      }
    }

    y += 6;
    y = asegurarEspacio(doc, y, 80, margenSup, margenInf);
    y = dibujarTituloSeccion(
      doc,
      x0,
      y,
      anchoUtil,
      'Cobertura territorial (veredas)',
    );

    const veredas = datos.veredasCobertura.slice(0, 12);
    if (veredas.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOR_SECUNDARIO)
        .text('Sin veredas georeferenciadas para el alcance seleccionado.', x0, y);
      y = doc.y + 12;
    } else {
      const colsVereda = [
        { etiqueta: 'Vereda', ancho: 0.32 },
        { etiqueta: 'Municipio', ancho: 0.28 },
        { etiqueta: 'Depto.', ancho: 0.22 },
        { etiqueta: 'Proyectos', ancho: 0.18 },
      ];
      const anchosV = colsVereda.map((c) => c.ancho * anchoUtil);
      const altoEnc = 20;
      y = asegurarEspacio(doc, y, altoEnc + 20, margenSup, margenInf);
      let xv = x0;
      colsVereda.forEach((c, i) => {
        dibujarCelda(doc, xv, y, anchosV[i], altoEnc, COLOR_ENCABEZADO);
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(COLOR_MARCA_OSCURO)
          .text(c.etiqueta.toUpperCase(), xv + 6, y + 6, {
            width: anchosV[i] - 12,
          });
        xv += anchosV[i];
      });
      y += altoEnc;
      for (const v of veredas) {
        y = asegurarEspacio(doc, y, 22, margenSup, margenInf);
        const valores = [
          v.nombre,
          v.municipio || '—',
          v.departamento || '—',
          String(v.proyectos.length),
        ];
        xv = x0;
        valores.forEach((val, i) => {
          dibujarCelda(doc, xv, y, anchosV[i], 20);
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(COLOR_TEXTO)
            .text(val, xv + 6, y + 5, {
              width: anchosV[i] - 12,
              lineBreak: false,
              ellipsis: true,
            });
          xv += anchosV[i];
        });
        y += 20;
      }
    }

    y += 12;
    y = asegurarEspacio(doc, y, 80, margenSup, margenInf);
    y = dibujarTituloSeccion(doc, x0, y, anchoUtil, 'Jornadas recientes');

    const jornadas = datos.jornadasRecientes;
    if (jornadas.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOR_SECUNDARIO)
        .text('Sin jornadas registradas en este alcance.', x0, y);
      y = doc.y + 12;
    } else {
      const colsJ = [
        { etiqueta: 'Proyecto', ancho: 0.28 },
        { etiqueta: 'Vereda', ancho: 0.2 },
        { etiqueta: 'Técnico', ancho: 0.22 },
        { etiqueta: 'Fecha', ancho: 0.15 },
        { etiqueta: 'Estado', ancho: 0.15 },
      ];
      const anchosJ = colsJ.map((c) => c.ancho * anchoUtil);
      const altoEncJ = 20;
      let xj = x0;
      colsJ.forEach((c, i) => {
        dibujarCelda(doc, xj, y, anchosJ[i], altoEncJ, COLOR_ENCABEZADO);
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(COLOR_MARCA_OSCURO)
          .text(c.etiqueta.toUpperCase(), xj + 6, y + 6, {
            width: anchosJ[i] - 12,
          });
        xj += anchosJ[i];
      });
      y += altoEncJ;
      for (const j of jornadas) {
        y = asegurarEspacio(doc, y, 22, margenSup, margenInf);
        const valores = [
          j.proyectoNombre || '—',
          j.veredaNombre || '—',
          j.tecnico || '—',
          j.fecha || '—',
          etiquetaEstadoJornada(j.estado),
        ];
        xj = x0;
        valores.forEach((val, i) => {
          dibujarCelda(doc, xj, y, anchosJ[i], 20);
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(COLOR_TEXTO)
            .text(val, xj + 6, y + 5, {
              width: anchosJ[i] - 12,
              lineBreak: false,
              ellipsis: true,
            });
          xj += anchosJ[i];
        });
        y += 20;
      }
    }

    if (datos.agentes.length > 0) {
      y += 12;
      y = asegurarEspacio(doc, y, 80, margenSup, margenInf);
      y = dibujarTituloSeccion(
        doc,
        x0,
        y,
        anchoUtil,
        'Agentes de campo más eficientes',
      );

      const colsA = datos.proyectoNombre
        ? [
            { etiqueta: '#', ancho: 0.08 },
            { etiqueta: 'Agente', ancho: 0.42 },
            { etiqueta: 'Índice', ancho: 0.16 },
            { etiqueta: 'Cumpl.', ancho: 0.16 },
            { etiqueta: 'Jornadas', ancho: 0.18 },
          ]
        : [
            { etiqueta: '#', ancho: 0.08 },
            { etiqueta: 'Agente', ancho: 0.3 },
            { etiqueta: 'Proyecto', ancho: 0.22 },
            { etiqueta: 'Índice', ancho: 0.13 },
            { etiqueta: 'Cumpl.', ancho: 0.13 },
            { etiqueta: 'Jornadas', ancho: 0.14 },
          ];
      const anchosA = colsA.map((c) => c.ancho * anchoUtil);
      const altoEncA = 20;
      let xa = x0;
      colsA.forEach((c, i) => {
        dibujarCelda(doc, xa, y, anchosA[i], altoEncA, COLOR_ENCABEZADO);
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(COLOR_MARCA_OSCURO)
          .text(c.etiqueta.toUpperCase(), xa + 6, y + 6, {
            width: anchosA[i] - 12,
          });
        xa += anchosA[i];
      });
      y += altoEncA;
      for (const a of datos.agentes) {
        y = asegurarEspacio(doc, y, 22, margenSup, margenInf);
        const valores = datos.proyectoNombre
          ? [
              String(a.puesto),
              a.nombreCompleto,
              String(a.indiceEficiencia),
              `${a.cumplimientoPorcentaje}%`,
              String(a.conteoJornadas),
            ]
          : [
              String(a.puesto),
              a.nombreCompleto,
              a.proyectoNombre || '—',
              String(a.indiceEficiencia),
              `${a.cumplimientoPorcentaje}%`,
              String(a.conteoJornadas),
            ];
        xa = x0;
        valores.forEach((val, i) => {
          dibujarCelda(doc, xa, y, anchosA[i], 20);
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(COLOR_TEXTO)
            .text(val, xa + 6, y + 5, {
              width: anchosA[i] - 12,
              lineBreak: false,
              ellipsis: true,
            });
          xa += anchosA[i];
        });
        y += 20;
      }
    }

    if (datos.kpis.proyectosRecientes.length > 0 && !datos.proyectoNombre) {
      y += 12;
      y = asegurarEspacio(doc, y, 70, margenSup, margenInf);
      y = dibujarTituloSeccion(
        doc,
        x0,
        y,
        anchoUtil,
        'Proyectos activos recientes',
      );
      for (const p of datos.kpis.proyectosRecientes.slice(0, 5)) {
        y = asegurarEspacio(doc, y, 18, margenSup, margenInf);
        dibujarLineaProyecto(doc, x0, y, anchoUtil, p);
        y += 18;
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const pieY = doc.page.height - 28;
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(COLOR_SECUNDARIO)
        .text(
          datos.generadoPor
            ? `Generado por ${datos.generadoPor}`
            : 'Ruralia — reporte operativo',
          margenIzq,
          pieY,
          { width: anchoUtil / 2, lineBreak: false },
        );
      doc.text(`Página ${i + 1} de ${range.count}`, margenIzq, pieY, {
        width: anchoUtil,
        align: 'right',
      });
    }

    doc.end();
  });
}

function etiquetaEstadoJornada(estado: string): string {
  switch (estado) {
    case 'COMPLETADA':
      return 'Completada';
    case 'EN_PROGRESO':
      return 'En progreso';
    case 'PLANIFICADA':
      return 'Planificada';
    case 'CANCELADA':
      return 'Cancelada';
    default:
      return estado;
  }
}

function dibujarLineaProyecto(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  ancho: number,
  p: ProyectoRecienteDashboardDto,
) {
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLOR_TEXTO)
    .text(p.nombre, x, y, { width: ancho - 90, lineBreak: false });
  const avance =
    p.progresoPorcentaje != null ? `${p.progresoPorcentaje}%` : '—';
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLOR_SECUNDARIO)
    .text(`${etiquetaEstado(p.estado)} · ${avance}`, x + ancho - 88, y, {
      width: 88,
      align: 'right',
    });
}
