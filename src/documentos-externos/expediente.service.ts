import { Injectable } from '@nestjs/common';
import { DocumentosService } from '../documentos/documentos.service';
import { DocumentosExternosService } from './documentos-externos.service';

@Injectable()
export class ExpedienteService {
  constructor(
    private readonly documentosService: DocumentosService,
    private readonly documentosExternosService: DocumentosExternosService,
  ) {}

  async obtenerExpediente(proyectoId: string) {
    const [documentosGenerados, documentosExternos] = await Promise.all([
      this.documentosService.listarPorProyecto(proyectoId),
      this.documentosExternosService.listar({ proyectoId }),
    ]);

    return {
      proyectoId,
      documentosGenerados,
      documentosExternos,
      totales: {
        generados: documentosGenerados.length,
        externos: documentosExternos.length,
        total: documentosGenerados.length + documentosExternos.length,
      },
    };
  }
}
