import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { CrearPlantillaFormularioDto } from './dto/formulario.dto';
import { RespuestaPlantillaFormularioDto } from './dto/respuesta-formulario.dto';
import { CampoFormulario } from './entities/campo-formulario.entity';
import { PlantillaFormulario } from './entities/plantilla-formulario.entity';
import { aRespuestaPlantilla } from './utils/serializar-formulario';

@Injectable()
export class PlantillasFormularioService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PlantillaFormulario)
    private readonly plantillaRepository: Repository<PlantillaFormulario>,
    @InjectRepository(Subactividad)
    private readonly subactividadRepository: Repository<Subactividad>,
  ) {}

  async crear(
    dto: CrearPlantillaFormularioDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    const subactividad = await this.subactividadRepository.findOne({
      where: { id: dto.subactividadId },
    });

    if (!subactividad) {
      throw new NotFoundException(
        `Subactividad ${dto.subactividadId} no encontrada`,
      );
    }

    const plantillaGuardada = await this.dataSource.transaction(
      async (manager) => {
        const plantilla = manager.create(PlantillaFormulario, {
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          version: dto.version ?? 1,
          estaActivo: false,
          subactividad: { id: dto.subactividadId },
        });

        const guardada = await manager.save(PlantillaFormulario, plantilla);

        const campos = dto.campos.map((campoDto, indice) =>
          manager.create(CampoFormulario, {
            etiqueta: campoDto.etiqueta,
            clave: campoDto.clave,
            tipoCampo: campoDto.tipoCampo,
            opciones: campoDto.opciones ?? null,
            esObligatorio: campoDto.esObligatorio ?? false,
            orden: campoDto.orden ?? indice,
            reglasValidacion: campoDto.reglasValidacion ?? null,
            plantillaFormulario: { id: guardada.id },
          }),
        );

        await manager.save(CampoFormulario, campos);
        return guardada;
      },
    );

    return this.obtenerPlantilla(plantillaGuardada.id);
  }

  async listarPorSubactividad(
    subactividadId: string,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    const plantillas = await this.plantillaRepository.find({
      where: { subactividad: { id: subactividadId } },
      relations: { campos: true },
      order: { version: 'DESC' },
    });

    return plantillas.map((p) => aRespuestaPlantilla(p));
  }

  async publicar(plantillaId: string): Promise<RespuestaPlantillaFormularioDto> {
    const plantilla = await this.plantillaRepository.findOne({
      where: { id: plantillaId },
      relations: { campos: true },
    });

    if (!plantilla) {
      throw new NotFoundException(`Plantilla ${plantillaId} no encontrada`);
    }

    if (!plantilla.campos?.length) {
      throw new BadRequestException(
        'La plantilla debe tener al menos un campo para publicarse',
      );
    }

    plantilla.estaActivo = true;
    await this.plantillaRepository.save(plantilla);
    return aRespuestaPlantilla(plantilla);
  }

  async clonar(
    plantillaId: string,
    nuevaSubactividadId: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    const original = await this.plantillaRepository.findOne({
      where: { id: plantillaId },
      relations: { campos: true },
    });

    if (!original) {
      throw new NotFoundException(`Plantilla ${plantillaId} no encontrada`);
    }

    const subactividad = await this.subactividadRepository.findOne({
      where: { id: nuevaSubactividadId },
    });

    if (!subactividad) {
      throw new NotFoundException(
        `Subactividad ${nuevaSubactividadId} no encontrada`,
      );
    }

    const clonada = await this.dataSource.transaction(async (manager) => {
      const nuevaPlantilla = manager.create(PlantillaFormulario, {
        nombre: `${original.nombre} (copia)`,
        descripcion: original.descripcion,
        version: 1,
        estaActivo: false,
        subactividad: { id: nuevaSubactividadId },
      });

      const guardada = await manager.save(PlantillaFormulario, nuevaPlantilla);

      const camposClonados = (original.campos ?? []).map((campo) =>
        manager.create(CampoFormulario, {
          etiqueta: campo.etiqueta,
          clave: campo.clave,
          tipoCampo: campo.tipoCampo,
          opciones: campo.opciones,
          esObligatorio: campo.esObligatorio,
          orden: campo.orden,
          reglasValidacion: campo.reglasValidacion,
          plantillaFormulario: { id: guardada.id },
        }),
      );

      if (camposClonados.length) {
        await manager.save(CampoFormulario, camposClonados);
      }

      return guardada;
    });

    return this.obtenerPlantilla(clonada.id);
  }

  private async obtenerPlantilla(
    id: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    const plantilla = await this.plantillaRepository.findOne({
      where: { id },
      relations: { campos: true },
    });

    if (!plantilla) {
      throw new NotFoundException(`Plantilla ${id} no encontrada`);
    }

    return aRespuestaPlantilla(plantilla);
  }
}
