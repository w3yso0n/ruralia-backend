import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvioFormulario } from './entities/envio-formulario.entity';
import { PlantillaFormulario } from './entities/plantilla-formulario.entity';
import { RespuestaFormulario } from './entities/respuesta-formulario.entity';
import { ProcesarEnvioJob } from '../cola/cola-envios.constants';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { EstadoJornada } from '../jornadas/enums/estado-jornada.enum';
import { TipoJornada } from '../jornadas/enums/tipo-jornada.enum';
import { TipoPlantilla } from './enums/tipo-plantilla.enum';

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
      relations: { meta: { proceso: true } },
    });

    if (!jornada?.meta?.proceso) {
      this.logger.log(
        `Jornada ${datos.jornadaId} sin meta/proceso asignado; se omite auto-cierre`,
      );
      return;
    }

    const tipoEsperado =
      jornada.tipo === TipoJornada.GRUPAL
        ? TipoPlantilla.GRUPAL
        : TipoPlantilla.INDIVIDUAL;

    const plantillasActivas = await this.plantillaRepository.find({
      where: {
        procesos: { id: jornada.meta.proceso.id },
        estaActivo: true,
        tipoPlantilla: tipoEsperado,
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
