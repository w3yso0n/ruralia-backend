import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';

export interface FilaReporteEvaluacion {
  puesto: number;
  nombreCompleto: string;
  proyectoNombre?: string | null;
  indiceEficiencia: number;
  cumplimientoPorcentaje: number;
  conteoJornadas: number;
  jornadasAprobadas: number;
  beneficiariosAtendidos: number;
  veredasCubiertas: number;
  jornadasConEvidencia: number;
  rechazosRevision: number;
  ritmoEjecucion: number;
}

export interface DatosPdfEvaluaciones {
  anio: number;
  mes: number;
  nombreMes: string;
  proyectoNombre?: string | null;
  generadoPor?: string | null;
  filas: FilaReporteEvaluacion[];
}

const COLOR_BORDE = '#d4ddd9';
const COLOR_ENCABEZADO = '#eef3f2';
const COLOR_TEXTO = '#121c2d';
const COLOR_SECUNDARIO = '#5b6b7a';
const COLOR_MARCA = '#42827a';
const COLOR_MARCA_OSCURO = '#2d524d';
const COLOR_MARCA_SUAVE = '#eef3f2';
const COLOR_TARJETA = '#ffffff';
const COLOR_FONDO_SUAVE = '#f7f9f8';

function formatearFechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
  colorFranja: string,
): number {
  if (doc.page.height - margenInf - y >= necesario) return y;
  doc.addPage();
  doc.save();
  doc.rect(0, 0, doc.page.width, 6).fill(colorFranja);
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

const COLUMNAS = [
  { clave: 'nombreCompleto', etiqueta: 'Agente', ancho: 2.4 },
  { clave: 'indiceEficiencia', etiqueta: 'Índice', ancho: 1 },
  { clave: 'cumplimientoPorcentaje', etiqueta: 'Cumpl.', ancho: 1 },
  { clave: 'conteoJornadas', etiqueta: 'Jornadas', ancho: 1 },
  { clave: 'beneficiariosAtendidos', etiqueta: 'Benef.', ancho: 1 },
  { clave: 'veredasCubiertas', etiqueta: 'Veredas', ancho: 1 },
  { clave: 'jornadasConEvidencia', etiqueta: 'Evidencia', ancho: 1 },
  { clave: 'rechazosRevision', etiqueta: 'Rechazos', ancho: 1 },
  { clave: 'ritmoEjecucion', etiqueta: 'Ritmo', ancho: 1 },
] as const;

export function generarPdfReporteEvaluaciones(
  datos: DatosPdfEvaluaciones,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 40,
      layout: 'landscape',
      info: {
        Title: `Reporte de evaluaciones — ${datos.nombreMes} ${datos.anio}`,
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
    const margenInf = doc.page.margins.bottom;
    const anchoUtil = doc.page.width - margenIzq - margenDer;
    const x0 = margenIzq;
    const logo = cargarLogoRuralia();

    // Franja superior de marca + bloque institucional
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
      .text('REPORTE DE EVALUACIONES', x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 4;

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLOR_MARCA_OSCURO)
      .text(datos.proyectoNombre ?? 'Todos los proyectos activos', x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 2;

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_SECUNDARIO)
      .text(`Periodo: ${datos.nombreMes} ${datos.anio}`, x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 14;

    // Panel de resumen
    const lider = datos.filas[0];
    const resumenItems: Array<{ etiqueta: string; valor: string }> = [
      { etiqueta: 'Agentes evaluados', valor: String(datos.filas.length) },
      {
        etiqueta: 'Líder del periodo',
        valor: lider ? lider.nombreCompleto : '—',
      },
      {
        etiqueta: 'Índice del líder',
        valor: lider ? String(lider.indiceEficiencia) : '—',
      },
      {
        etiqueta: 'Jornadas totales',
        valor: String(datos.filas.reduce((s, f) => s + f.conteoJornadas, 0)),
      },
    ];

    y = dibujarTituloSeccion(doc, x0, y, anchoUtil, 'Resumen del periodo');

    const gapResumen = 10;
    const anchoResumen = (anchoUtil - gapResumen * 3) / 4;
    const altoResumen = 40;

    resumenItems.forEach((item, idx) => {
      const x = x0 + idx * (anchoResumen + gapResumen);
      dibujarRectRedondeado(doc, x, y, anchoResumen, altoResumen, 6, {
        relleno: COLOR_FONDO_SUAVE,
        borde: COLOR_BORDE,
      });
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(COLOR_SECUNDARIO)
        .text(item.etiqueta.toUpperCase(), x + 10, y + 8, {
          width: anchoResumen - 20,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(COLOR_TEXTO)
        .text(item.valor, x + 10, y + 20, {
          width: anchoResumen - 20,
          ellipsis: true,
          lineBreak: false,
        });
    });
    y += altoResumen + 16;

    // Tabla de ranking
    y = asegurarEspacio(doc, y, 50, margenSup, margenInf, COLOR_MARCA);
    y = dibujarTituloSeccion(doc, x0, y, anchoUtil, 'Ranking de productividad');

    const colNum = 24;
    const sumaAnchos = COLUMNAS.reduce((s, c) => s + c.ancho, 0);
    const anchoBase = (anchoUtil - colNum) / sumaAnchos;
    const anchosCols = COLUMNAS.map((c) => c.ancho * anchoBase);
    const altoFila = 26;

    const dibujarEncabezadoTabla = (yPos: number) => {
      const altoEnc = 24;
      dibujarCelda(doc, x0, yPos, colNum, altoEnc, COLOR_ENCABEZADO);
      let xAcum = x0 + colNum;
      COLUMNAS.forEach((_col, i) => {
        dibujarCelda(
          doc,
          xAcum,
          yPos,
          anchosCols[i],
          altoEnc,
          COLOR_ENCABEZADO,
        );
        xAcum += anchosCols[i];
      });

      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_MARCA_OSCURO);
      doc.text('#', x0 + 3, yPos + 9, { width: colNum - 6, align: 'center' });
      xAcum = x0 + colNum;
      COLUMNAS.forEach((col, i) => {
        doc.text(col.etiqueta.toUpperCase(), xAcum + 4, yPos + 9, {
          width: anchosCols[i] - 8,
          align: col.clave === 'nombreCompleto' ? 'left' : 'center',
        });
        xAcum += anchosCols[i];
      });
      doc.font('Helvetica');
      return yPos + altoEnc;
    };

    y = dibujarEncabezadoTabla(y);

    if (datos.filas.length === 0) {
      dibujarRectRedondeado(doc, x0, y, anchoUtil, 32, 4, {
        relleno: COLOR_FONDO_SUAVE,
        borde: COLOR_BORDE,
      });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOR_SECUNDARIO)
        .text(
          'No hay actividad de campo ni cuotas asignadas en este periodo.',
          x0 + 12,
          y + 11,
          { width: anchoUtil - 24 },
        );
      y += 40;
    }

    datos.filas.forEach((fila, index) => {
      y = asegurarEspacio(
        doc,
        y,
        altoFila + 4,
        margenSup,
        margenInf,
        COLOR_MARCA,
      );
      if (y === margenSup) {
        y = dibujarEncabezadoTabla(y);
      }

      const rellenoFila = index % 2 === 0 ? COLOR_TARJETA : COLOR_FONDO_SUAVE;
      dibujarCelda(doc, x0, y, colNum, altoFila, rellenoFila);
      let xAcum = x0 + colNum;
      anchosCols.forEach((ancho) => {
        dibujarCelda(doc, xAcum, y, ancho, altoFila, rellenoFila);
        xAcum += ancho;
      });

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR_SECUNDARIO)
        .text(String(fila.puesto), x0 + 2, y + altoFila / 2 - 4, {
          width: colNum - 4,
          align: 'center',
        });

      const valores: Record<(typeof COLUMNAS)[number]['clave'], string> = {
        nombreCompleto: fila.proyectoNombre
          ? `${fila.nombreCompleto}\n${fila.proyectoNombre}`
          : fila.nombreCompleto,
        indiceEficiencia: String(fila.indiceEficiencia),
        cumplimientoPorcentaje: `${fila.cumplimientoPorcentaje}%`,
        conteoJornadas: `${fila.conteoJornadas} (${fila.jornadasAprobadas})`,
        beneficiariosAtendidos: String(fila.beneficiariosAtendidos),
        veredasCubiertas: String(fila.veredasCubiertas),
        jornadasConEvidencia: String(fila.jornadasConEvidencia),
        rechazosRevision: String(fila.rechazosRevision),
        ritmoEjecucion: String(fila.ritmoEjecucion),
      };

      xAcum = x0 + colNum;
      COLUMNAS.forEach((col, i) => {
        const esNombre = col.clave === 'nombreCompleto';
        doc
          .font(esNombre ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(esNombre ? 8 : 8)
          .fillColor(esNombre ? COLOR_TEXTO : COLOR_TEXTO)
          .text(valores[col.clave], xAcum + 4, y + altoFila / 2 - 4, {
            width: anchosCols[i] - 8,
            align: esNombre ? 'left' : 'center',
            ellipsis: true,
            lineBreak: false,
          });
        xAcum += anchosCols[i];
      });

      y += altoFila;
    });

    // Pie fijo
    const pieY = doc.page.height - 28;
    const margenInfOriginal = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .strokeColor(COLOR_MARCA)
      .lineWidth(1.5)
      .moveTo(x0, pieY - 10)
      .lineTo(x0 + anchoUtil, pieY - 10)
      .stroke();

    if (logo) {
      try {
        doc.image(logo, x0, pieY - 2, { fit: [14, 14] });
      } catch {
        // sin logo en pie
      }
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLOR_MARCA_OSCURO)
      .text('RURALIA', x0 + (logo ? 20 : 0), pieY, {
        width: anchoUtil * 0.35,
        align: 'left',
        lineBreak: false,
      });

    const textoPie = `Generado por ${datos.generadoPor ?? 'Ruralia'} · ${datos.filas.length} agente(s) · ${formatearFechaCorta(new Date())}`;

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOR_SECUNDARIO)
      .text(textoPie, x0 + anchoUtil * 0.35, pieY, {
        width: anchoUtil * 0.65,
        align: 'right',
        lineBreak: false,
      });

    doc.page.margins.bottom = margenInfOriginal;
    doc.end();
  });
}
