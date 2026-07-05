import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EstadoEvidencia } from '../evidencias/enums/estado-evidencia.enum';
import { CampoFormulario } from '../formularios/entities/campo-formulario.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { RespuestaFormulario } from '../formularios/entities/respuesta-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { JornadaActividad } from '../jornadas/entities/jornada-actividad.entity';
import { EstadoEjecucionJornada } from '../jornadas/enums/estado-ejecucion-jornada.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  EnvioFormularioOfflineDto,
  EvidenciaOfflineDto,
  JornadaOfflineDto,
  SubirSincronizacionDto,
} from './dto/subir-sincronizacion.dto';
import {
  ErrorSincronizacionDto,
  ResultadoSincronizacionDto,
} from './dto/resultado-sincronizacion.dto';

@Injectable()
export class SincronizacionService {
  constructor(private readonly dataSource: DataSource) {}

  async subir(dto: SubirSincronizacionDto): Promise<ResultadoSincronizacionDto> {
    let aceptados = 0;
    let omitidos = 0;
    const errores: ErrorSincronizacionDto[] = [];
    const mapaJornadas = new Map<string, string>();
    const ahora = new Date();

    await this.dataSource.transaction(async (manager) => {
      for (const jornadaDto of dto.jornadas) {
        const resultado = await this.procesarJornada(
          manager,
          dto.dispositivoId,
          jornadaDto,
          ahora,
        );

        if (resultado.omitido) {
          omitidos++;
          mapaJornadas.set(jornadaDto.idLocal, resultado.id!);
          continue;
        }

        if (resultado.error) {
          errores.push(resultado.error);
          continue;
        }

        aceptados++;
        mapaJornadas.set(jornadaDto.idLocal, resultado.id!);
      }

      for (const envioDto of dto.enviosFormulario) {
        const jornadaId = await this.resolverJornadaId(
          manager,
          dto.dispositivoId,
          envioDto.jornadaIdLocal,
          mapaJornadas,
        );

        if (!jornadaId) {
          errores.push({
            tipo: 'envio',
            idLocal: envioDto.idLocal,
            mensaje: `Jornada local ${envioDto.jornadaIdLocal} no encontrada`,
          });
          continue;
        }

        const resultado = await this.procesarEnvio(
          manager,
          dto.dispositivoId,
          envioDto,
          jornadaId,
          ahora,
        );

        if (resultado.omitido) {
          omitidos++;
          continue;
        }

        if (resultado.error) {
          errores.push(resultado.error);
          continue;
        }

        aceptados++;
      }

      for (const evidenciaDto of dto.evidencias) {
        const jornadaId = await this.resolverJornadaId(
          manager,
          dto.dispositivoId,
          evidenciaDto.jornadaIdLocal,
          mapaJornadas,
        );

        if (!jornadaId) {
          errores.push({
            tipo: 'evidencia',
            idLocal: evidenciaDto.idLocal,
            mensaje: `Jornada local ${evidenciaDto.jornadaIdLocal} no encontrada`,
          });
          continue;
        }

        const resultado = await this.procesarEvidencia(
          manager,
          dto.dispositivoId,
          evidenciaDto,
          jornadaId,
          ahora,
        );

        if (resultado.omitido) {
          omitidos++;
          continue;
        }

        if (resultado.error) {
          errores.push(resultado.error);
          continue;
        }

        aceptados++;
      }
    });

    return { aceptados, omitidos, errores };
  }

  private async procesarJornada(
    manager: EntityManager,
    dispositivoId: string,
    dto: JornadaOfflineDto,
    sincronizadoEn: Date,
  ): Promise<{
    id?: string;
    omitido?: boolean;
    error?: ErrorSincronizacionDto;
  }> {
    const existente = await manager.findOne(Jornada, {
      where: { dispositivoId, idLocal: dto.idLocal },
    });

    if (existente) {
      return { id: existente.id, omitido: true };
    }

    try {
      const jornadaActividades = dto.actividades.map((item, index) =>
        manager.create(JornadaActividad, {
          actividad: { id: item.actividadId },
          subactividad: item.subactividadId
            ? { id: item.subactividadId }
            : undefined,
          estadoEjecucion: EstadoEjecucionJornada.PENDIENTE,
          orden: index,
        }),
      );

      const jornada = manager.create(Jornada, {
        fecha: new Date(dto.fecha),
        estado: dto.estado,
        observaciones: dto.observaciones,
        latitud: dto.latitud,
        longitud: dto.longitud,
        proyecto: { id: dto.proyectoId },
        vereda: { id: dto.veredaId },
        tecnicoResponsable: { id: dto.tecnicoResponsableId },
        jornadaActividades,
        esOffline: true,
        sincronizadoEn,
        idLocal: dto.idLocal,
        dispositivoId,
      });

      if (dto.beneficiarioIds?.length) {
        jornada.beneficiarios = dto.beneficiarioIds.map((id) =>
          manager.create(Beneficiario, { id }),
        );
      }

      if (dto.equipoIds?.length) {
        jornada.equipo = dto.equipoIds.map((id) =>
          manager.create(Usuario, { id }),
        );
      }

      const guardada = await manager.save(Jornada, jornada);
      return { id: guardada.id };
    } catch (error) {
      return {
        error: {
          tipo: 'jornada',
          idLocal: dto.idLocal,
          mensaje: error instanceof Error ? error.message : 'Error desconocido',
        },
      };
    }
  }

  private async procesarEnvio(
    manager: EntityManager,
    dispositivoId: string,
    dto: EnvioFormularioOfflineDto,
    jornadaId: string,
    sincronizadoEn: Date,
  ): Promise<{ omitido?: boolean; error?: ErrorSincronizacionDto }> {
    const existente = await manager.findOne(EnvioFormulario, {
      where: { dispositivoId, idLocal: dto.idLocal },
    });

    if (existente) {
      return { omitido: true };
    }

    try {
      const plantilla = await manager.findOne(PlantillaFormulario, {
        where: { id: dto.plantillaFormularioId },
      });

      if (!plantilla) {
        return {
          error: {
            tipo: 'envio',
            idLocal: dto.idLocal,
            mensaje: `Plantilla ${dto.plantillaFormularioId} no encontrada`,
          },
        };
      }

      const envio = manager.create(EnvioFormulario, {
        enviadoEn: new Date(dto.enviadoEn),
        sincronizadoEn,
        esOffline: true,
        datosRaw: dto.datosRaw ?? null,
        idLocal: dto.idLocal,
        dispositivoId,
        jornada: { id: jornadaId },
        plantillaFormulario: { id: dto.plantillaFormularioId },
      });

      const envioGuardado = await manager.save(EnvioFormulario, envio);

      for (const respuestaDto of dto.respuestas) {
        const campo = await manager.findOne(CampoFormulario, {
          where: { id: respuestaDto.campoFormularioId },
        });

        if (!campo) {
          continue;
        }

        const respuesta = manager.create(RespuestaFormulario, {
          claveCampo: respuestaDto.claveCampo,
          valorTexto: respuestaDto.valorTexto,
          valorNumero: respuestaDto.valorNumero,
          valorFecha: respuestaDto.valorFecha
            ? new Date(respuestaDto.valorFecha)
            : undefined,
          valorBooleano: respuestaDto.valorBooleano,
          valorJson: respuestaDto.valorJson ?? null,
          urlArchivo: respuestaDto.urlArchivo,
          envioFormulario: { id: envioGuardado.id },
          campoFormulario: { id: respuestaDto.campoFormularioId },
        });

        await manager.save(RespuestaFormulario, respuesta);
      }

      return {};
    } catch (error) {
      return {
        error: {
          tipo: 'envio',
          idLocal: dto.idLocal,
          mensaje: error instanceof Error ? error.message : 'Error desconocido',
        },
      };
    }
  }

  private async procesarEvidencia(
    manager: EntityManager,
    dispositivoId: string,
    dto: EvidenciaOfflineDto,
    jornadaId: string,
    sincronizadoEn: Date,
  ): Promise<{ omitido?: boolean; error?: ErrorSincronizacionDto }> {
    const existente = await manager.findOne(Evidencia, {
      where: { dispositivoId, idLocal: dto.idLocal },
    });

    if (existente) {
      return { omitido: true };
    }

    try {
      const evidencia = manager.create(Evidencia, {
        tipo: dto.tipo,
        estado: EstadoEvidencia.PENDIENTE_ARCHIVO,
        nombreArchivo: dto.nombreArchivo,
        tipoMime: dto.tipoMime,
        tamanoArchivo: dto.tamanoArchivo,
        capturadoEn: new Date(dto.capturadoEn),
        latitud: dto.latitud,
        longitud: dto.longitud,
        esOffline: true,
        sincronizadoEn,
        idLocal: dto.idLocal,
        dispositivoId,
        jornada: { id: jornadaId },
      });

      await manager.save(Evidencia, evidencia);
      return {};
    } catch (error) {
      return {
        error: {
          tipo: 'evidencia',
          idLocal: dto.idLocal,
          mensaje: error instanceof Error ? error.message : 'Error desconocido',
        },
      };
    }
  }

  private async resolverJornadaId(
    manager: EntityManager,
    dispositivoId: string,
    idLocal: string,
    mapaJornadas: Map<string, string>,
  ): Promise<string | null> {
    const delMapa = mapaJornadas.get(idLocal);
    if (delMapa) {
      return delMapa;
    }

    const jornada = await manager.findOne(Jornada, {
      where: { dispositivoId, idLocal },
    });

    return jornada?.id ?? null;
  }
}
