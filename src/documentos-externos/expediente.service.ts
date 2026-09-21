import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentosService } from '../documentos/documentos.service';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { DocumentosExternosService } from './documentos-externos.service';

@Injectable()
export class ExpedienteService {
  constructor(
    private readonly documentosService: DocumentosService,
    private readonly documentosExternosService: DocumentosExternosService,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepo: Repository<Evidencia>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepo: Repository<EnvioFormulario>,
  ) {}

  async obtenerExpediente(proyectoId: string) {
    const [documentosGenerados, documentosExternos, evidencias, envios] =
      await Promise.all([
        this.documentosService.listarPorProyecto(proyectoId),
        this.documentosExternosService.listar({ proyectoId }),
        this.evidenciaRepo.find({
          where: { jornada: { proyecto: { id: proyectoId } } },
          relations: { jornada: { beneficiarios: true } },
          order: { capturadoEn: 'DESC' },
        }),
        this.envioRepo.find({
          where: { jornada: { proyecto: { id: proyectoId } } },
          relations: {
            jornada: { beneficiarios: true },
            plantillaFormulario: true,
            usuario: true,
            respuestas: { campoFormulario: true },
          },
          order: { enviadoEn: 'DESC' },
        }),
      ]);

    const formularios = envios
      .filter((envio) => envio.jornada)
      .map((envio) => ({
        id: envio.id,
        enviadoEn: envio.enviadoEn,
        plantillaNombre: envio.plantillaFormulario?.nombre ?? 'Formulario',
        usuarioNombre: envio.usuario?.nombreCompleto ?? null,
        jornada: this.jornadaPlana(envio.jornada!),
        adjuntos: (envio.respuestas ?? [])
          .map((respuesta) => this.adjuntoDeRespuesta(respuesta))
          .filter((adjunto) => adjunto != null),
      }));

    return {
      proyectoId,
      documentosGenerados,
      documentosExternos,
      evidencias,
      formularios,
      totales: {
        generados: documentosGenerados.length,
        externos: documentosExternos.length,
        evidencias: evidencias.length,
        formularios: formularios.length,
        total:
          documentosGenerados.length +
          documentosExternos.length +
          evidencias.length +
          formularios.length,
      },
    };
  }

  private jornadaPlana(jornada: Jornada) {
    return {
      id: jornada.id,
      fecha: jornada.fecha,
      nombre: jornada.nombre,
      tecnicoResponsableNombre: jornada.tecnicoResponsableNombre,
      beneficiarios: (jornada.beneficiarios ?? []).map((persona) => ({
        id: persona.id,
        nombres: persona.nombres,
        apellidos: persona.apellidos,
      })),
    };
  }

  private adjuntoDeRespuesta(respuesta: RespuestaFormulario) {
    const tipo = respuesta.campoFormulario?.tipoCampo;
    const url =
      respuesta.urlArchivo ||
      (respuesta.valorTexto &&
      (respuesta.valorTexto.startsWith('data:') ||
        respuesta.valorTexto.startsWith('http'))
        ? respuesta.valorTexto
        : null);
    if (!url) return null;
    if (tipo && !['FOTO', 'FIRMA', 'ARCHIVO'].includes(tipo) && !url.startsWith('data:image')) {
      return null;
    }
    return {
      etiqueta: respuesta.campoFormulario?.etiqueta ?? respuesta.claveCampo,
      tipoCampo: tipo ?? 'ARCHIVO',
      url,
    };
  }
}
