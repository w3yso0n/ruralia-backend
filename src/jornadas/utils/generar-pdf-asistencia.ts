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
}

export interface SeccionTablaPdfAsistencia {
  titulo?: string;
  columnas: ColumnaPdfAsistencia[];
  filas: Array<Record<string, string | null>>;
}

export interface DatosPdfAsistencia {
  proyectoNombre: string;
  plantillaNombre?: string;
  fecha: Date | string;
  veredaNombre?: string;
  metaNombre?: string;
  observaciones?: string | null;
  cabecera?: ItemCabeceraPdfAsistencia[];
  tablas: SeccionTablaPdfAsistencia[];
}

const COLOR_BORDE = '#1f2937';
const COLOR_ENCABEZADO = '#e8eeed';
const COLOR_TEXTO = '#121c2d';
const COLOR_SECUNDARIO = '#4b5563';
const COLOR_MARCA = '#42827a';
const COLOR_MARCA_OSCURO = '#2d524d';
const COLOR_MARCA_SUAVE = '#eef3f2';

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
  doc.strokeColor(COLOR_BORDE).lineWidth(0.9).rect(x, y, w, h).stroke();
}

export function generarPdfAsistenciaJornada(
  datos: DatosPdfAsistencia,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 40,
      info: {
        Title: `Listado de asistencia — ${datos.proyectoNombre}`,
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
    const anchoEtiqueta = Math.min(160, Math.floor(anchoUtil * 0.32));
    const anchoValor = anchoUtil - anchoEtiqueta;
    const altoFilaCabecera = 26;
    const altoFilaFirmaCabecera = 56;
    const altoFilaTabla = 48;
    const colNum = 22;
    const logo = cargarLogoRuralia();

    // Franja superior de marca + bloque institucional pegado arriba
    const altoFranja = 8;
    const paddingMarca = 10;
    const altoLogo = 48;
    const yLogo = altoFranja + paddingMarca;
    const altoBloqueMarca = paddingMarca + altoLogo + paddingMarca;

    doc.save();
    doc.rect(0, 0, doc.page.width, altoFranja).fill(COLOR_MARCA);
    doc.rect(0, altoFranja, doc.page.width, altoBloqueMarca).fill(COLOR_MARCA_SUAVE);
    doc.restore();

    if (logo) {
      try {
        doc.image(logo, x0, yLogo, {
          fit: [48, altoLogo],
          align: 'center',
          valign: 'center',
        });
      } catch {
        // si el logo falla, seguimos sin imagen
      }
    } else {
      doc.save();
      doc.roundedRect(x0, yLogo, 48, 48, 6).fill('#ffffff');
      doc
        .strokeColor(COLOR_MARCA)
        .lineWidth(1.2)
        .roundedRect(x0, yLogo, 48, 48, 6)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(COLOR_MARCA)
        .text('R', x0, yLogo + 14, { width: 48, align: 'center' });
      doc.restore();
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

    // Linea de acento justo debajo del bloque de marca
    let y = altoFranja + altoBloqueMarca;
    doc
      .strokeColor(COLOR_MARCA)
      .lineWidth(2)
      .moveTo(x0, y)
      .lineTo(x0 + anchoUtil, y)
      .stroke();
    y += 14;

    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(COLOR_TEXTO)
      .text('LISTADO DE ASISTENCIA', x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 3;

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLOR_MARCA_OSCURO)
      .text(datos.proyectoNombre, x0, y, {
        width: anchoUtil,
        align: 'center',
      });
    y = doc.y + 2;

    if (datos.plantillaNombre) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR_SECUNDARIO)
        .text(datos.plantillaNombre, x0, y, {
          width: anchoUtil,
          align: 'center',
        });
      y = doc.y + 8;
    } else {
      y += 8;
    }

    const metaFilas: ItemCabeceraPdfAsistencia[] = [
      {
        etiqueta: 'Fecha',
        valor: formatearFechaCorta(datos.fecha),
      },
      ...(datos.veredaNombre
        ? [{ etiqueta: 'Lugar / vereda', valor: datos.veredaNombre }]
        : []),
      ...(datos.metaNombre
        ? [{ etiqueta: 'Meta / actividad', valor: datos.metaNombre }]
        : []),
      ...(datos.observaciones
        ? [{ etiqueta: 'Observaciones', valor: datos.observaciones }]
        : []),
    ];

    const cabeceraFormulario = (datos.cabecera ?? []).map((item) => ({
      ...item,
      esFirma: item.esFirma === true || esDataUrlImagen(item.valor),
    }));

    const filasCabecera = [...metaFilas, ...cabeceraFormulario];

    for (const item of filasCabecera) {
      const esFirma = Boolean(item.esFirma) || esDataUrlImagen(item.valor);
      const alto = esFirma ? altoFilaFirmaCabecera : altoFilaCabecera;

      if (doc.page.height - margenInf - y < alto + 8) {
        doc.addPage();
        y = margenSup;
      }

      dibujarCelda(doc, x0, y, anchoEtiqueta, alto, COLOR_ENCABEZADO);
      dibujarCelda(doc, x0 + anchoEtiqueta, y, anchoValor, alto);

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLOR_TEXTO)
        .text(item.etiqueta.toUpperCase(), x0 + 6, y + (esFirma ? 20 : 8), {
          width: anchoEtiqueta - 12,
        });

      if (esFirma && item.valor) {
        const buffer = bufferDesdeDataUrl(item.valor);
        if (buffer) {
          try {
            doc.image(buffer, x0 + anchoEtiqueta + 8, y + 6, {
              fit: [anchoValor - 16, alto - 12],
              align: 'center',
              valign: 'center',
            });
          } catch {
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(COLOR_SECUNDARIO)
              .text('(firma)', x0 + anchoEtiqueta + 8, y + 20, {
                width: anchoValor - 16,
              });
          }
        } else {
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(COLOR_SECUNDARIO)
            .text('(sin firma)', x0 + anchoEtiqueta + 8, y + 20, {
              width: anchoValor - 16,
            });
        }
      } else {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLOR_TEXTO)
          .text(item.valor || '—', x0 + anchoEtiqueta + 8, y + 8, {
            width: anchoValor - 16,
            ellipsis: true,
          });
      }

      y += alto;
    }

    let totalFilas = 0;

    for (const seccion of datos.tablas) {
      const cols = seccion.columnas;
      if (cols.length === 0) continue;

      y += 16;

      if (seccion.titulo) {
        if (doc.page.height - margenInf - y < 40) {
          doc.addPage();
          y = margenSup;
        }
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(COLOR_MARCA_OSCURO)
          .text(seccion.titulo.toUpperCase(), x0, y, { width: anchoUtil });
        y = doc.y + 6;
      }

      const anchoCols = Math.max(
        36,
        Math.floor((anchoUtil - colNum) / cols.length),
      );

      const dibujarEncabezadoTabla = (yPos: number) => {
        const altoEnc = 24;
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

        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_TEXTO);
        doc.text('#', x0 + 3, yPos + 8, { width: colNum - 6, align: 'center' });
        cols.forEach((col, i) => {
          doc.text(
            col.etiqueta.toUpperCase(),
            x0 + colNum + i * anchoCols + 3,
            yPos + 8,
            { width: anchoCols - 6, align: 'center' },
          );
        });
        doc.font('Helvetica');
        return yPos + altoEnc;
      };

      y = dibujarEncabezadoTabla(y);

      if (seccion.filas.length === 0) {
        dibujarCelda(doc, x0, y, anchoUtil, 32);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLOR_SECUNDARIO)
          .text('Sin registros en esta lista.', x0 + 8, y + 10, {
            width: anchoUtil - 16,
          });
        y += 32;
        continue;
      }

      seccion.filas.forEach((fila, index) => {
        if (doc.page.height - margenInf - y < altoFilaTabla + 8) {
          doc.addPage();
          // Franja de marca tambien en paginas siguientes
          doc.save();
          doc.rect(0, 0, doc.page.width, 6).fill(COLOR_MARCA);
          doc.restore();
          y = dibujarEncabezadoTabla(margenSup);
        }

        dibujarCelda(doc, x0, y, colNum, altoFilaTabla);
        cols.forEach((_col, i) => {
          dibujarCelda(
            doc,
            x0 + colNum + i * anchoCols,
            y,
            anchoCols,
            altoFilaTabla,
          );
        });

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(COLOR_TEXTO)
          .text(String(index + 1), x0 + 2, y + altoFilaTabla / 2 - 4, {
            width: colNum - 4,
            align: 'center',
          });

        cols.forEach((col, i) => {
          const cellX = x0 + colNum + i * anchoCols + 3;
          const cellW = anchoCols - 6;
          const valor = fila[col.clave];
          const comoFirma =
            Boolean(col.esFirma) || esDataUrlImagen(valor ?? undefined);

          if (comoFirma && valor) {
            const buffer = bufferDesdeDataUrl(valor);
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
              .text(valor || '—', cellX, y + altoFilaTabla / 2 - 4, {
                width: cellW,
                ellipsis: true,
              });
          }
        });

        y += altoFilaTabla;
      });

      totalFilas += seccion.filas.length;
    }

    // Pie fijo en la ultima pagina (sin disparar salto de pagina de PDFKit)
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

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOR_SECUNDARIO)
      .text(
        `Generado por Ruralia · ${totalFilas} asistente(s) · ${formatearFechaCorta(datos.fecha)}`,
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
