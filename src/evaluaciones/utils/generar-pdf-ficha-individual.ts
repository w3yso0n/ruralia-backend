import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';

export interface FilaAsignacionFicha {
  metaNombre: string;
  unidadMedida: string;
  periodo: string;
  cantidadAsignada: number;
  ejecutado: number;
  cumplimientoPorcentaje: number;
}

export interface FilaDesviacionFicha {
  metaNombre: string;
  unidadMedida: string;
  cantidadAsignada: number;
  ejecutado: number;
  cumplimientoPorcentaje: number;
  sinEjecucion: boolean;
  incumplida: boolean;
}

export interface DatosPdfFichaIndividual {
  nombreCompleto: string;
  correo?: string | null;
  anio: number;
  mes: number;
  nombreMes: string;
  proyectoNombre?: string | null;
  generadoPor?: string | null;
  cumplimientoPromedio: number;
  totalAsignado: number;
  totalEjecutado: number;
  conteoJornadas: number;
  beneficiariosAtendidos: number;
  veredasCubiertas: number;
  rechazosRevision: number;
  asignaciones: FilaAsignacionFicha[];
  desviaciones?: {
    metasConCuota: number;
    fallosSinEjecucion: number;
    incumplimientos: number;
    detalle: FilaDesviacionFicha[];
  } | null;
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
const COLOR_EXITO = '#047857';
const COLOR_EXITO_FONDO = '#ecfdf5';
const COLOR_ADVERTENCIA = '#b45309';
const COLOR_ADVERTENCIA_FONDO = '#fffbeb';
const COLOR_ERROR = '#b91c1c';
const COLOR_ERROR_FONDO = '#fef2f2';

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

const COLUMNAS_ASIGNACIONES = [
  { clave: 'metaNombre', etiqueta: 'Meta', ancho: 2.2 },
  { clave: 'periodo', etiqueta: 'Periodo', ancho: 1.1 },
  { clave: 'cantidadAsignada', etiqueta: 'Asignado', ancho: 1 },
  { clave: 'ejecutado', etiqueta: 'Ejecutado', ancho: 1 },
  { clave: 'cumplimientoPorcentaje', etiqueta: '%', ancho: 0.8 },
] as const;

const COLUMNAS_DESVIACIONES = [
  { clave: 'metaNombre', etiqueta: 'Meta', ancho: 2.2 },
  { clave: 'cantidadAsignada', etiqueta: 'Asignado', ancho: 1 },
  { clave: 'ejecutado', etiqueta: 'Ejecutado', ancho: 1 },
  { clave: 'cumplimientoPorcentaje', etiqueta: '%', ancho: 0.8 },
  { clave: 'estado', etiqueta: 'Estado', ancho: 1.2 },
] as const;

function dibujarTabla<T extends object>(
  doc: PDFKit.PDFDocument,
  x0: number,
  yInicial: number,
  anchoUtil: number,
  margenSup: number,
  margenInf: number,
  columnas: ReadonlyArray<{ clave: string; etiqueta: string; ancho: number }>,
  filas: T[],
  valorCelda: (fila: T, clave: string) => string,
  colorCelda?: (
    fila: T,
    clave: string,
  ) => { texto?: string; fondo?: string } | null,
  mensajeVacio = 'Sin registros.',
): number {
  let y = yInicial;
  const colNum = 22;
  const sumaAnchos = columnas.reduce((s, c) => s + c.ancho, 0);
  const anchoBase = (anchoUtil - colNum) / sumaAnchos;
  const anchosCols = columnas.map((c) => c.ancho * anchoBase);
  const altoFila = 24;

  const dibujarEncabezado = (yPos: number) => {
    const altoEnc = 22;
    dibujarCelda(doc, x0, yPos, colNum, altoEnc, COLOR_ENCABEZADO);
    let xAcum = x0 + colNum;
    columnas.forEach((_col, i) => {
      dibujarCelda(doc, xAcum, yPos, anchosCols[i], altoEnc, COLOR_ENCABEZADO);
      xAcum += anchosCols[i];
    });
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_MARCA_OSCURO);
    doc.text('#', x0 + 3, yPos + 8, { width: colNum - 6, align: 'center' });
    xAcum = x0 + colNum;
    columnas.forEach((col, i) => {
      doc.text(col.etiqueta.toUpperCase(), xAcum + 4, yPos + 8, {
        width: anchosCols[i] - 8,
        align: col.clave === 'metaNombre' ? 'left' : 'center',
      });
      xAcum += anchosCols[i];
    });
    doc.font('Helvetica');
    return yPos + altoEnc;
  };

  y = dibujarEncabezado(y);

  if (filas.length === 0) {
    dibujarRectRedondeado(doc, x0, y, anchoUtil, 28, 4, {
      relleno: COLOR_FONDO_SUAVE,
      borde: COLOR_BORDE,
    });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLOR_SECUNDARIO)
      .text(mensajeVacio, x0 + 10, y + 9, { width: anchoUtil - 20 });
    return y + 36;
  }

  filas.forEach((fila, index) => {
    y = asegurarEspacio(
      doc,
      y,
      altoFila + 4,
      margenSup,
      margenInf,
      COLOR_MARCA,
    );
    if (y === margenSup) {
      y = dibujarEncabezado(y);
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
      .fontSize(7.5)
      .fillColor(COLOR_SECUNDARIO)
      .text(String(index + 1), x0 + 2, y + altoFila / 2 - 4, {
        width: colNum - 4,
        align: 'center',
      });

    xAcum = x0 + colNum;
    columnas.forEach((col, i) => {
      const esNombre = col.clave === 'metaNombre';
      const estilo = colorCelda?.(fila, col.clave);
      if (estilo?.fondo) {
        dibujarRectRedondeado(
          doc,
          xAcum + 3,
          y + 4,
          anchosCols[i] - 6,
          altoFila - 8,
          4,
          { relleno: estilo.fondo },
        );
      }
      doc
        .font(esNombre ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(7.5)
        .fillColor(estilo?.texto ?? COLOR_TEXTO)
        .text(valorCelda(fila, col.clave), xAcum + 4, y + altoFila / 2 - 4, {
          width: anchosCols[i] - 8,
          align: esNombre ? 'left' : 'center',
          ellipsis: true,
          lineBreak: false,
        });
      xAcum += anchosCols[i];
    });

    y += altoFila;
  });

  return y;
}

export function generarPdfFichaIndividual(
  datos: DatosPdfFichaIndividual,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 40,
      info: {
        Title: `Ficha de evaluación — ${datos.nombreCompleto}`,
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
    const altoLogo = 48;
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
          fit: [48, altoLogo],
          align: 'center',
          valign: 'center',
        });
      } catch {
        // sin logo
      }
    } else {
      dibujarRectRedondeado(doc, x0, yLogo, 48, 48, 6, {
        relleno: '#ffffff',
        borde: COLOR_MARCA,
        grosor: 1.2,
      });
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(COLOR_MARCA)
        .text('R', x0, yLogo + 14, { width: 48, align: 'center' });
    }

    const xMarca = x0 + 60;
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(COLOR_MARCA_OSCURO)
      .text('RURALIA', xMarca, yLogo + 2, {
        width: anchoUtil - 70,
        lineBreak: false,
      });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_SECUNDARIO)
      .text('Gestión de proyectos territoriales', xMarca, yLogo + 22, {
        width: anchoUtil - 70,
        lineBreak: false,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(COLOR_MARCA)
      .text('DOCUMENTO INSTITUCIONAL', xMarca, yLogo + 36, {
        width: anchoUtil - 70,
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
      .text('FICHA DE EVALUACIÓN INDIVIDUAL', x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 4;

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLOR_MARCA_OSCURO)
      .text(datos.nombreCompleto, x0, y, { width: anchoUtil, align: 'center' });
    y = doc.y + 2;

    const subtitulo = [
      datos.correo,
      datos.proyectoNombre ?? 'Todos los proyectos',
      `${datos.nombreMes} ${datos.anio}`,
    ]
      .filter(Boolean)
      .join(' · ');

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_SECUNDARIO)
      .text(subtitulo, x0, y, { width: anchoUtil, align: 'center' });
    y = doc.y + 14;

    // Panel de métricas resumen
    y = dibujarTituloSeccion(doc, x0, y, anchoUtil, 'Resumen del periodo');

    const metricas: Array<{ etiqueta: string; valor: string }> = [
      {
        etiqueta: 'Cumplimiento promedio',
        valor: `${datos.cumplimientoPromedio}%`,
      },
      {
        etiqueta: 'Asignado / Ejecutado',
        valor: `${datos.totalAsignado} / ${datos.totalEjecutado}`,
      },
      { etiqueta: 'Jornadas', valor: String(datos.conteoJornadas) },
      {
        etiqueta: 'Beneficiarios / Veredas',
        valor: `${datos.beneficiariosAtendidos} / ${datos.veredasCubiertas}`,
      },
      {
        etiqueta: 'Rechazos en revisión',
        valor: String(datos.rechazosRevision),
      },
    ];

    const gap = 8;
    const anchoTarjeta =
      (anchoUtil - gap * (metricas.length - 1)) / metricas.length;
    const altoTarjeta = 42;

    metricas.forEach((item, idx) => {
      const x = x0 + idx * (anchoTarjeta + gap);
      dibujarRectRedondeado(doc, x, y, anchoTarjeta, altoTarjeta, 6, {
        relleno: COLOR_FONDO_SUAVE,
        borde: COLOR_BORDE,
      });
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(COLOR_SECUNDARIO)
        .text(item.etiqueta.toUpperCase(), x + 8, y + 8, {
          width: anchoTarjeta - 16,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(COLOR_TEXTO)
        .text(item.valor, x + 8, y + 22, {
          width: anchoTarjeta - 16,
          ellipsis: true,
          lineBreak: false,
        });
    });
    y += altoTarjeta + 18;

    // Tabla de asignaciones (metas y cuotas)
    y = asegurarEspacio(doc, y, 50, margenSup, margenInf, COLOR_MARCA);
    y = dibujarTituloSeccion(doc, x0, y, anchoUtil, 'Metas asignadas');

    y = dibujarTabla(
      doc,
      x0,
      y,
      anchoUtil,
      margenSup,
      margenInf,
      COLUMNAS_ASIGNACIONES,
      datos.asignaciones,
      (fila, clave) => {
        switch (clave) {
          case 'metaNombre':
            return `${fila.metaNombre} (${fila.unidadMedida})`;
          case 'periodo':
            return fila.periodo;
          case 'cantidadAsignada':
            return String(fila.cantidadAsignada);
          case 'ejecutado':
            return String(fila.ejecutado);
          case 'cumplimientoPorcentaje':
            return `${fila.cumplimientoPorcentaje}%`;
          default:
            return '';
        }
      },
      undefined,
      'Sin cuotas asignadas en este periodo.',
    );
    y += 16;

    // Desviaciones vs planeación
    if (datos.desviaciones) {
      y = asegurarEspacio(doc, y, 50, margenSup, margenInf, COLOR_MARCA);
      y = dibujarTituloSeccion(
        doc,
        x0,
        y,
        anchoUtil,
        'Desviaciones vs planeación',
      );

      const resumenDesv: Array<{ etiqueta: string; valor: string }> = [
        {
          etiqueta: 'Metas con cuota',
          valor: String(datos.desviaciones.metasConCuota),
        },
        {
          etiqueta: 'Fallos sin ejecución',
          valor: String(datos.desviaciones.fallosSinEjecucion),
        },
        {
          etiqueta: 'Incumplimientos (<100%)',
          valor: String(datos.desviaciones.incumplimientos),
        },
      ];

      const anchoResumenDesv =
        (anchoUtil - gap * (resumenDesv.length - 1)) / resumenDesv.length;

      resumenDesv.forEach((item, idx) => {
        const x = x0 + idx * (anchoResumenDesv + gap);
        dibujarRectRedondeado(doc, x, y, anchoResumenDesv, altoTarjeta, 6, {
          relleno: COLOR_FONDO_SUAVE,
          borde: COLOR_BORDE,
        });
        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor(COLOR_SECUNDARIO)
          .text(item.etiqueta.toUpperCase(), x + 8, y + 8, {
            width: anchoResumenDesv - 16,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(COLOR_TEXTO)
          .text(item.valor, x + 8, y + 22, {
            width: anchoResumenDesv - 16,
            ellipsis: true,
            lineBreak: false,
          });
      });
      y += altoTarjeta + 12;

      y = dibujarTabla(
        doc,
        x0,
        y,
        anchoUtil,
        margenSup,
        margenInf,
        COLUMNAS_DESVIACIONES,
        datos.desviaciones.detalle,
        (fila, clave) => {
          switch (clave) {
            case 'metaNombre':
              return `${fila.metaNombre} (${fila.unidadMedida})`;
            case 'cantidadAsignada':
              return String(fila.cantidadAsignada);
            case 'ejecutado':
              return String(fila.ejecutado);
            case 'cumplimientoPorcentaje':
              return `${fila.cumplimientoPorcentaje}%`;
            case 'estado':
              return fila.sinEjecucion
                ? 'Sin ejecución'
                : fila.incumplida
                  ? 'Incumplida'
                  : 'Cumplida';
            default:
              return '';
          }
        },
        (fila, clave) => {
          if (clave !== 'estado') return null;
          if (fila.sinEjecucion) {
            return { texto: COLOR_ERROR, fondo: COLOR_ERROR_FONDO };
          }
          if (fila.incumplida) {
            return { texto: COLOR_ADVERTENCIA, fondo: COLOR_ADVERTENCIA_FONDO };
          }
          return { texto: COLOR_EXITO, fondo: COLOR_EXITO_FONDO };
        },
        'Sin cuotas en este periodo para calcular desviaciones.',
      );
    }

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

    const textoPie = `Generado por ${datos.generadoPor ?? 'Ruralia'} · ${formatearFechaCorta(new Date())}`;

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
