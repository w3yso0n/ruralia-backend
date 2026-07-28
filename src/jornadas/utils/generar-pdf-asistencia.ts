import PDFDocument from 'pdfkit';

export interface ColumnaPdfAsistencia {
  clave: string;
  etiqueta: string;
  esFirma?: boolean;
}

export interface DatosPdfAsistencia {
  proyectoNombre: string;
  plantillaNombre?: string;
  fecha: Date | string;
  veredaNombre?: string;
  metaNombre?: string;
  observaciones?: string | null;
  columnas: ColumnaPdfAsistencia[];
  filas: Array<Record<string, string | null>>;
}

function formatearFecha(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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

export function generarPdfAsistenciaJornada(
  datos: DatosPdfAsistencia,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 48,
      info: {
        Title: `Lista de asistencia — ${datos.proyectoNombre}`,
        Author: 'Ruralia',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const anchoUtil =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colNum = 28;
    const cols = datos.columnas;
    const anchoCols = Math.max(
      40,
      Math.floor((anchoUtil - colNum) / Math.max(cols.length, 1)),
    );
    const altoFila = 52;
    const x0 = doc.page.margins.left;

    doc
      .fontSize(16)
      .fillColor('#0f766e')
      .text('Lista de asistencia', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#18181b').text(datos.proyectoNombre);
    if (datos.plantillaNombre) {
      doc.fontSize(9).fillColor('#52525b').text(`Formulario: ${datos.plantillaNombre}`);
    }
    doc.fontSize(9).text(`Fecha: ${formatearFecha(datos.fecha)}`);
    if (datos.veredaNombre) doc.text(`Vereda: ${datos.veredaNombre}`);
    if (datos.metaNombre) doc.text(`Meta: ${datos.metaNombre}`);

    doc.moveDown(0.8);

    const dibujarEncabezado = (y: number) => {
      doc.save();
      doc.rect(x0, y, anchoUtil, 22).fill('#f4f4f5');
      doc.restore();
      doc.fontSize(8).fillColor('#3f3f46').font('Helvetica-Bold');
      doc.text('#', x0 + 4, y + 7, { width: colNum - 4 });
      cols.forEach((col, i) => {
        doc.text(col.etiqueta, x0 + colNum + i * anchoCols + 4, y + 7, {
          width: anchoCols - 8,
        });
      });
      doc.font('Helvetica');
      return y + 22;
    };

    let y = dibujarEncabezado(doc.y);

    if (datos.filas.length === 0) {
      doc.fontSize(10).fillColor('#71717a').text('Sin asistentes registrados.', x0, y + 12);
    }

    datos.filas.forEach((fila, index) => {
      if (doc.page.height - doc.page.margins.bottom - y < altoFila + 8) {
        doc.addPage();
        y = dibujarEncabezado(doc.page.margins.top);
      }

      doc.strokeColor('#e4e4e7').lineWidth(0.5).rect(x0, y, anchoUtil, altoFila).stroke();
      doc.fontSize(9).fillColor('#18181b');
      doc.text(String(index + 1), x0 + 4, y + 18, { width: colNum - 4 });

      cols.forEach((col, i) => {
        const cellX = x0 + colNum + i * anchoCols + 4;
        const cellW = anchoCols - 8;
        const valor = fila[col.clave];

        if (col.esFirma && valor) {
          const buffer = bufferDesdeDataUrl(valor);
          if (buffer) {
            try {
              doc.image(buffer, cellX, y + 6, {
                fit: [cellW, altoFila - 12],
                align: 'center',
                valign: 'center',
              });
            } catch {
              doc.fontSize(7).fillColor('#a1a1aa').text('(firma)', cellX, y + 20, { width: cellW });
            }
          } else {
            doc.fontSize(7).fillColor('#a1a1aa').text('(sin firma)', cellX, y + 20, { width: cellW });
          }
        } else {
          doc.fontSize(8).fillColor('#52525b').text(valor || '—', cellX, y + 18, {
            width: cellW,
            ellipsis: true,
          });
        }
      });

      y += altoFila;
    });

    doc
      .fontSize(8)
      .fillColor('#a1a1aa')
      .text(
        `Generado por Ruralia · ${datos.filas.length} asistente(s)`,
        x0,
        doc.page.height - 36,
        { width: anchoUtil, align: 'center' },
      );

    doc.end();
  });
}
