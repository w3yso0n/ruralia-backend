import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnvioFormulario } from './entities/envio-formulario.entity';
import { PlantillaFormulario } from './entities/plantilla-formulario.entity';
import { RespuestaFormulario } from './entities/respuesta-formulario.entity';
import { ProcesarEnvioJob } from '../cola/cola-envios.constants';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { EstadoJornada } from '../jornadas/enums/estado-jornada.enum';

@Injectable()
export class EnvioProcesamientoService {
  private readonly logger = new Logger(EnvioProcesamientoService.name);

  constructor(
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(PlantillaFormulario)
    private readonly plantillaRepository: Repository<PlantillaFormulario>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
  ) {}

  async procesarEnvio(datos: ProcesarEnvioJob): Promise<void> {
    const jornada = await this.jornadaRepository.findOne({
      where: { id: datos.jornadaId },
      relations: { jornadaActividades: { subactividad: true } },
    });

    if (!jornada?.jornadaActividades?.length) {
      return;
    }

    const subactividadIds = [
      ...new Set(
        jornada.jornadaActividades
          .map((ja) => ja.subactividad?.id)
          .filter((id): id is string => !!id),
      ),
    ];

    if (!subactividadIds.length) {
      return;
    }

    const plantillasActivas = await this.plantillaRepository.find({
      where: {
        subactividades: { id: In(subactividadIds) },
        estaActivo: true,
      },
      relations: { campos: true },
    });

    if (!plantillasActivas.length) {
      return;
    }

    const todasCompletas = await this.verificarFormulariosObligatorios(
      datos.jornadaId,
      plantillasActivas,
    );

    if (!todasCompletas) {
      return;
    }

    if (jornada.estado === EstadoJornada.EN_PROGRESO) {
      jornada.estado = EstadoJornada.COMPLETADA;
      await this.jornadaRepository.save(jornada);
      this.logger.log(
        `Jornada ${jornada.id} marcada como COMPLETADA automáticamente`,
      );
    }
  }

  private async verificarFormulariosObligatorios(
    jornadaId: string,
    plantillas: PlantillaFormulario[],
  ): Promise<boolean> {
    for (const plantilla of plantillas) {
      const envios = await this.envioRepository.find({
        where: {
          jornada: { id: jornadaId },
          plantillaFormulario: { id: plantilla.id },
        },
        relations: { respuestas: true },
      });

      if (!envios.length) {
        return false;
      }

      const camposObligatorios =
        plantilla.campos?.filter((campo) => campo.esObligatorio) ?? [];

      const tieneEnvioCompleto = envios.some((envio) =>
        camposObligatorios.every((campo) =>
          envio.respuestas?.some(
            (respuesta) =>
              respuesta.claveCampo === campo.clave &&
              this.respuestaTieneValor(respuesta),
          ),
        ),
      );

      if (!tieneEnvioCompleto) {
        return false;
      }
    }

    return true;
  }

  private respuestaTieneValor(respuesta: RespuestaFormulario): boolean {
    return (
      respuesta.valorTexto != null ||
      respuesta.valorNumero != null ||
      respuesta.valorFecha != null ||
      respuesta.valorBooleano != null ||
      respuesta.valorJson != null ||
      respuesta.urlArchivo != null
    );
  }
}
