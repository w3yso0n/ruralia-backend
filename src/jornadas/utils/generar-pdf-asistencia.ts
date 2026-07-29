import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';

export interface ColumnaPdfAsistencia {
  clave: string;
  etiqueta: string;
  esFirma?: boolean;
}

export interface ItemCabeceraPdfAsistencia {
  etiqueta: string;
  valor: string | null;
  esFirma?: boolean;
  tipoCampo?: string;
}

export interface SeccionTablaPdfAsistencia {
  titulo?: string;
  columnas: ColumnaPdfAsistencia[];
  filas: Array<Record<string, string | null>>;
}

export interface DatosPdfAsistencia {
  proyectoNombre: string;
  plantillaNombre?: string;
  /** Título principal del documento. Por defecto: LISTADO DE ASISTENCIA */
  tituloDocumento?: string;
  /** Texto del pie (p. ej. "3 asistente(s)" o "2 respuesta(s)"). */
  resumenPie?: string;
  fecha: Date | string;
  veredaNombre?: string;
  metaNombre?: string;
  unidadMedida?: string | null;
  cantidadEjecutada?: number | null;
  tecnicoNombre?: string | null;
  observaciones?: string | null;
  cabecera?: ItemCabeceraPdfAsistencia[];
  tablas: SeccionTablaPdfAsistencia[];
}

const COLOR_BORDE = '#d4ddd9';
const COLOR_BORDE_FUERTE = '#9bb5af';
const COLOR_ENCABEZADO = '#eef3f2';
const COLOR_TEXTO = '#121c2d';
const COLOR_SECUNDARIO = '#5b6b7a';
const COLOR_MARCA = '#42827a';
const COLOR_MARCA_OSCURO = '#2d524d';
const COLOR_MARCA_SUAVE = '#eef3f2';
const COLOR_TARJETA = '#ffffff';
const COLOR_FONDO_SUAVE = '#f7f9f8';
const COLOR_SI = '#047857';
const COLOR_SI_FONDO = '#ecfdf5';
const COLOR_NO = '#4b5563';
const COLOR_NO_FONDO = '#f3f4f6';

function formatearFechaCorta(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function esDataUrlImagen(valor: string | null | undefined): boolean {
  return Boolean(valor && /^data:image\/\w+;base64,/i.test(valor.trim()));
}

function bufferDesdeDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:image\/\w+;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

/** Limpia valores crudos tipo ["21-30"] para lectura humana. */
export function limpiarValorRespuesta(valor: string | null | undefined): string {
  if (valor == null || valor === '') return '—';
  const texto = valor.trim();
  if (texto.startsWith('[')) {
    try {
      const parsed = JSON.parse(texto) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v)).filter(Boolean).join(', ') || '—';
      }
    } catch {
      // texto plano
    }
  }
  return texto;
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

function altoTarjetaCampo(item: ItemCabeceraPdfAsistencia): number {
  if (item.esFirma || esDataUrlImagen(item.valor)) return 78;
  const valor = limpiarValorRespuesta(item.valor);
  const lineas = Math.ceil(valor.length / 42);
  return Math.max(52, 34 + lineas * 12);
}

export function generarPdfAsistenciaJornada(
  datos: DatosPdfAsistencia,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 40,
      info: {
        Title: `${datos.tituloDocumento ?? 'Listado de asistencia'} — ${datos.proyectoNombre}`,
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
    const altoFilaTabla = 48;
    const colNum = 22;
    const logo = cargarLogoRuralia();
    const esReporteFormulario = (datos.tituloDocumento ?? '')
      .toUpperCase()
      .includes('FORMULARIO');

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
      .text(datos.tituloDocumento ?? 'LISTADO DE ASISTENCIA', x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 4;

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLOR_MARCA_OSCURO)
      .text(datos.proyectoNombre, x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 2;

    if (datos.plantillaNombre) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOR_SECUNDARIO)
        .text(datos.plantillaNombre, x0, y, {
          width: anchoUtil,
          align: 'center',
        });
      y = doc.y + 12;
    } else {
      y += 10;
    }

    // Panel de contexto (meta de la jornada)
    const contextoItems: Array<{ etiqueta: string; valor: string }> = [
      { etiqueta: 'Fecha', valor: formatearFechaCorta(datos.fecha) },
      ...(datos.veredaNombre
        ? [{ etiqueta: 'Vereda', valor: datos.veredaNombre }]
        : []),
      ...(datos.tecnicoNombre
        ? [{ etiqueta: 'Agente', valor: datos.tecnicoNombre }]
        : []),
      ...(datos.metaNombre
        ? [{ etiqueta: 'Meta', valor: datos.metaNombre }]
        : []),
      ...(datos.observaciones
        ? [{ etiqueta: 'Observaciones', valor: datos.observaciones }]
        : []),
    ];

    y = dibujarTituloSeccion(doc, x0, y, anchoUtil, 'Datos de la jornada');

    const gapContexto = 10;
    const anchoContexto = (anchoUtil - gapContexto) / 2;
    const altoContexto = 40;

    for (let i = 0; i < contextoItems.length; i += 2) {
      y = asegurarEspacio(
        doc,
        y,
        altoContexto + 8,
        margenSup,
        margenInf,
        COLOR_MARCA,
      );
      const par = [contextoItems[i], contextoItems[i + 1]].filter(Boolean);

      par.forEach((item, idx) => {
        const x = x0 + idx * (anchoContexto + gapContexto);
        dibujarRectRedondeado(doc, x, y, anchoContexto, altoContexto, 6, {
          relleno: COLOR_FONDO_SUAVE,
          borde: COLOR_BORDE,
        });
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(COLOR_SECUNDARIO)
          .text(item.etiqueta.toUpperCase(), x + 10, y + 8, {
            width: anchoContexto - 20,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COLOR_TEXTO)
          .text(item.valor, x + 10, y + 20, {
            width: anchoContexto - 20,
            ellipsis: true,
            lineBreak: false,
          });
      });
      y += altoContexto + 8;
    }

    // Destacado de unidades ejecutadas
    if (datos.cantidadEjecutada != null) {
      y = asegurarEspacio(doc, y, 52, margenSup, margenInf, COLOR_MARCA);
      dibujarRectRedondeado(doc, x0, y, anchoUtil, 44, 8, {
        relleno: COLOR_MARCA_SUAVE,
        borde: COLOR_BORDE_FUERTE,
        grosor: 1,
      });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR_MARCA_OSCURO)
        .text('UNIDADES EJECUTADAS EN ESTA JORNADA', x0 + 14, y + 9, {
          width: anchoUtil - 28,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(COLOR_MARCA)
        .text(
          `${Number(datos.cantidadEjecutada)}${
            datos.unidadMedida ? ` ${datos.unidadMedida}` : ''
          }`,
          x0 + 14,
          y + 21,
          { width: anchoUtil - 28 },
        );
      y += 56;
    }

    // Respuestas del formulario / cabecera de asistencia
    const respuestas = (datos.cabecera ?? []).map((item) => {
      const esFirma = item.esFirma === true || esDataUrlImagen(item.valor);
      return {
        ...item,
        esFirma,
        valor: esFirma ? item.valor : limpiarValorRespuesta(item.valor),
      };
    });

    if (respuestas.length > 0) {
      y = asegurarEspacio(doc, y, 30, margenSup, margenInf, COLOR_MARCA);
      y = dibujarTituloSeccion(
        doc,
        x0,
        y,
        anchoUtil,
        esReporteFormulario
          ? 'Respuestas del formulario'
          : 'Datos del evento',
      );

      const gap = 10;
      const anchoTarjeta = (anchoUtil - gap) / 2;
      let col = 0;
      let yFila = y;
      let altoFilaActual = 0;

      const volcarFila = () => {
        y = yFila + altoFilaActual + 8;
        col = 0;
        altoFilaActual = 0;
        yFila = y;
      };

      for (const item of respuestas) {
        const ancho =
          item.esFirma || item.tipoCampo === 'GPS' || item.tipoCampo === 'FOTO'
            ? anchoUtil
            : anchoTarjeta;
        const alto = altoTarjetaCampo(item);

        if (col === 1 && ancho === anchoUtil) {
          volcarFila();
        }

        if (col === 0) {
          y = asegurarEspacio(
            doc,
            yFila,
            alto + 8,
            margenSup,
            margenInf,
            COLOR_MARCA,
          );
          yFila = y;
        }

        const x = col === 0 ? x0 : x0 + anchoTarjeta + gap;
        dibujarRectRedondeado(doc, x, yFila, ancho, alto, 7, {
          relleno: COLOR_TARJETA,
          borde: COLOR_BORDE,
        });

        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(COLOR_SECUNDARIO)
          .text(item.etiqueta.toUpperCase(), x + 12, yFila + 10, {
            width: ancho - 24,
          });

        if (item.esFirma && item.valor && esDataUrlImagen(item.valor)) {
          const buffer = bufferDesdeDataUrl(item.valor);
          if (buffer) {
            try {
              doc.image(buffer, x + 12, yFila + 24, {
                fit: [ancho - 24, alto - 34],
                align: 'center',
                valign: 'center',
              });
            } catch {
              doc
                .font('Helvetica')
                .fontSize(9)
                .fillColor(COLOR_SECUNDARIO)
                .text('(firma no disponible)', x + 12, yFila + 28, {
                  width: ancho - 24,
                });
            }
          }
        } else if (item.tipoCampo === 'SI_NO') {
          const afirmativo = /^(sí|si|true|1)$/i.test(
            String(item.valor ?? '').trim(),
          );
          const negativo = /^(no|false|0)$/i.test(
            String(item.valor ?? '').trim(),
          );
          const etiquetaSiNo = afirmativo ? 'Sí' : negativo ? 'No' : item.valor || '—';
          const fondo = afirmativo
            ? COLOR_SI_FONDO
            : negativo
              ? COLOR_NO_FONDO
              : COLOR_FONDO_SUAVE;
          const color = afirmativo
            ? COLOR_SI
            : negativo
              ? COLOR_NO
              : COLOR_TEXTO;
          dibujarRectRedondeado(doc, x + 12, yFila + 26, 42, 18, 9, {
            relleno: fondo,
          });
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(color)
            .text(etiquetaSiNo, x + 12, yFila + 30, {
              width: 42,
              align: 'center',
            });
        } else {
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor(COLOR_TEXTO)
            .text(item.valor || '—', x + 12, yFila + 26, {
              width: ancho - 24,
            });
        }

        if (ancho === anchoUtil) {
          altoFilaActual = Math.max(altoFilaActual, alto);
          volcarFila();
        } else if (col === 0) {
          altoFilaActual = alto;
          col = 1;
        } else {
          altoFilaActual = Math.max(altoFilaActual, alto);
          volcarFila();
        }
      }

      if (col === 1) {
        volcarFila();
      }
      y += 4;
    }

    let totalFilas = 0;

    for (const seccion of datos.tablas) {
      const cols = seccion.columnas;
      if (cols.length === 0) continue;

      y = asegurarEspacio(doc, y, 50, margenSup, margenInf, COLOR_MARCA);
      y = dibujarTituloSeccion(
        doc,
        x0,
        y,
        anchoUtil,
        seccion.titulo ?? 'Registros',
      );

      const anchoCols = Math.max(
        36,
        Math.floor((anchoUtil - colNum) / cols.length),
      );

      const dibujarEncabezadoTabla = (yPos: number) => {
        const altoEnc = 26;
        dibujarCelda(doc, x0, yPos, colNum, altoEnc, COLOR_ENCABEZADO);
        cols.forEach((_col, i) => {
          dibujarCelda(
            doc,
            x0 + colNum + i * anchoCols,
            yPos,
            anchoCols,
            altoEnc,
            COLOR_ENCABEZADO,
          );
        });

        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_MARCA_OSCURO);
        doc.text('#', x0 + 3, yPos + 9, { width: colNum - 6, align: 'center' });
        cols.forEach((col, i) => {
          doc.text(
            col.etiqueta.toUpperCase(),
            x0 + colNum + i * anchoCols + 3,
            yPos + 9,
            { width: anchoCols - 6, align: 'center' },
          );
        });
        doc.font('Helvetica');
        return yPos + altoEnc;
      };

      y = dibujarEncabezadoTabla(y);

      if (seccion.filas.length === 0) {
        dibujarRectRedondeado(doc, x0, y, anchoUtil, 32, 4, {
          relleno: COLOR_FONDO_SUAVE,
          borde: COLOR_BORDE,
        });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLOR_SECUNDARIO)
          .text('Sin registros en esta lista.', x0 + 12, y + 11, {
            width: anchoUtil - 24,
          });
        y += 40;
        continue;
      }

      seccion.filas.forEach((fila, index) => {
        y = asegurarEspacio(
          doc,
          y,
          altoFilaTabla + 8,
          margenSup,
          margenInf,
          COLOR_MARCA,
        );
        if (y === margenSup) {
          y = dibujarEncabezadoTabla(y);
        }

        const rellenoFila = index % 2 === 0 ? COLOR_TARJETA : COLOR_FONDO_SUAVE;
        dibujarCelda(doc, x0, y, colNum, altoFilaTabla, rellenoFila);
        cols.forEach((_col, i) => {
          dibujarCelda(
            doc,
            x0 + colNum + i * anchoCols,
            y,
            anchoCols,
            altoFilaTabla,
            rellenoFila,
          );
        });

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(COLOR_SECUNDARIO)
          .text(String(index + 1), x0 + 2, y + altoFilaTabla / 2 - 4, {
            width: colNum - 4,
            align: 'center',
          });

        cols.forEach((col, i) => {
          const cellX = x0 + colNum + i * anchoCols + 3;
          const cellW = anchoCols - 6;
          const valorCrudo = fila[col.clave];
          const valor = limpiarValorRespuesta(valorCrudo);
          const comoFirma =
            Boolean(col.esFirma) || esDataUrlImagen(valorCrudo ?? undefined);

          if (comoFirma && valorCrudo) {
            const buffer = bufferDesdeDataUrl(valorCrudo);
            if (buffer) {
              try {
                doc.image(buffer, cellX, y + 4, {
                  fit: [cellW, altoFilaTabla - 8],
                  align: 'center',
                  valign: 'center',
                });
              } catch {
                doc
                  .fontSize(7)
                  .fillColor(COLOR_SECUNDARIO)
                  .text('(firma)', cellX, y + altoFilaTabla / 2 - 4, {
                    width: cellW,
                    align: 'center',
                  });
              }
            } else {
              doc
                .fontSize(7)
                .fillColor(COLOR_SECUNDARIO)
                .text('(sin firma)', cellX, y + altoFilaTabla / 2 - 4, {
                  width: cellW,
                  align: 'center',
                });
            }
          } else {
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(COLOR_TEXTO)
              .text(valor, cellX, y + altoFilaTabla / 2 - 4, {
                width: cellW,
                ellipsis: true,
              });
          }
        });

        y += altoFilaTabla;
      });

      totalFilas += seccion.filas.length;
      y += 8;
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

    const textoResumen = datos.resumenPie ?? `${totalFilas} asistente(s)`;

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOR_SECUNDARIO)
      .text(
        `Generado por Ruralia · ${textoResumen} · ${formatearFechaCorta(datos.fecha)}`,
        x0 + anchoUtil * 0.35,
        pieY,
        {
          width: anchoUtil * 0.65,
          align: 'right',
          lineBreak: false,
        },
      );

    doc.page.margins.bottom = margenInfOriginal;
    doc.end();
  });
}
