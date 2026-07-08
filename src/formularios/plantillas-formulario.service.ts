import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarPlantillaFormularioDto,
  CrearPlantillaFormularioDto,
} from './dto/formulario.dto';
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
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async crear(
    dto: CrearPlantillaFormularioDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    const subactividades = await this.resolverSubactividades(
      dto.subactividadIds,
    );
    const usuarios = await this.resolverUsuarios(dto.usuarioIds);

    const plantillaGuardada = await this.dataSource.transaction(
      async (manager) => {
        const plantilla = manager.create(PlantillaFormulario, {
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          version: dto.version ?? 1,
          estaActivo: false,
          subactividades,
          usuarios,
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

  async listarTodas(): Promise<RespuestaPlantillaFormularioDto[]> {
    const plantillas = await this.plantillaRepository.find({
      relations: { campos: true, subactividades: true, usuarios: true },
      order: { nombre: 'ASC' },
    });

    return plantillas.map((p) => aRespuestaPlantilla(p));
  }

  async obtenerPorId(id: string): Promise<RespuestaPlantillaFormularioDto> {
    return this.obtenerPlantilla(id);
  }

  async actualizar(
    id: string,
    dto: ActualizarPlantillaFormularioDto,
  ): Promise<RespuestaPlantillaFormularioDto> {
    const plantilla = await this.plantillaRepository.findOne({
      where: { id },
      relations: { campos: true },
    });

    if (!plantilla) {
      throw new NotFoundException(`Plantilla ${id} no encontrada`);
    }

    const subactividades = dto.subactividadIds
      ? await this.resolverSubactividades(dto.subactividadIds)
      : undefined;
    const usuarios = dto.usuarioIds
      ? await this.resolverUsuarios(dto.usuarioIds)
      : undefined;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(PlantillaFormulario, {
        id,
        nombre: dto.nombre ?? plantilla.nombre,
        descripcion: dto.descripcion ?? plantilla.descripcion,
        subactividades,
        usuarios,
      });

      if (dto.campos) {
        const idsExistentes = plantilla.campos.map((c) => c.id);
        const idsConservados = dto.campos
          .map((c) => c.id)
          .filter((cid): cid is string => Boolean(cid));

        const idsAEliminar = idsExistentes.filter(
          (cid) => !idsConservados.includes(cid),
        );

        if (idsAEliminar.length) {
          await manager.delete(CampoFormulario, idsAEliminar);
        }

        for (const [indice, campoDto] of dto.campos.entries()) {
          const datosCampo = {
            etiqueta: campoDto.etiqueta,
            clave: campoDto.clave,
            tipoCampo: campoDto.tipoCampo,
            opciones: campoDto.opciones ?? null,
            esObligatorio: campoDto.esObligatorio ?? false,
            orden: campoDto.orden ?? indice,
            reglasValidacion: campoDto.reglasValidacion ?? null,
          };

          if (campoDto.id) {
            await manager.save(CampoFormulario, {
              id: campoDto.id,
              ...datosCampo,
            });
          } else {
            const nuevoCampo = manager.create(CampoFormulario, {
              ...datosCampo,
              plantillaFormulario: { id },
            });
            await manager.save(CampoFormulario, nuevoCampo);
          }
        }
      }
    });

    return this.obtenerPlantilla(id);
  }

  async asignarSubactividades(
    id: string,
    subactividadIds: string[],
  ): Promise<RespuestaPlantillaFormularioDto> {
    const plantilla = await this.plantillaRepository.findOne({
      where: { id },
    });

    if (!plantilla) {
      throw new NotFoundException(`Plantilla ${id} no encontrada`);
    }

    const subactividades = await this.resolverSubactividades(subactividadIds);

    await this.plantillaRepository.save({ id, subactividades });

    return this.obtenerPlantilla(id);
  }

  async asignarUsuarios(
    id: string,
    usuarioIds: string[],
  ): Promise<RespuestaPlantillaFormularioDto> {
    const plantilla = await this.plantillaRepository.findOne({
      where: { id },
    });

    if (!plantilla) {
      throw new NotFoundException(`Plantilla ${id} no encontrada`);
    }

    const usuarios = await this.resolverUsuarios(usuarioIds);

    await this.plantillaRepository.save({ id, usuarios });

    return this.obtenerPlantilla(id);
  }

  async listarPorSubactividad(
    subactividadId: string,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    const plantillas = await this.plantillaRepository.find({
      where: { subactividades: { id: subactividadId } },
      relations: { campos: true, subactividades: true, usuarios: true },
      order: { version: 'DESC' },
    });

    return plantillas.map((p) => aRespuestaPlantilla(p));
  }

  async listarAsignadasAUsuario(
    usuario: Usuario,
  ): Promise<RespuestaPlantillaFormularioDto[]> {
    const plantillas = await this.plantillaRepository
      .createQueryBuilder('plantilla')
      .leftJoinAndSelect('plantilla.campos', 'campos')
      .leftJoinAndSelect('plantilla.subactividades', 'subactividades')
      .leftJoinAndSelect('plantilla.usuarios', 'usuarios')
      .where('plantilla.esta_activo = true')
      .andWhere(
        `(
          usuarios.id = :usuarioId
          OR subactividades.id IN (
            SELECT sub.id
            FROM subactividades sub
            INNER JOIN actividades act ON act.id = sub.actividad_id
            INNER JOIN proyecto_personal pp ON pp.proyecto_id = act.proyecto_id
            WHERE pp.usuario_id = :usuarioId
          )
        )`,
        { usuarioId: usuario.id },
      )
      .orderBy('plantilla.nombre', 'ASC')
      .getMany();

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

  async clonar(plantillaId: string): Promise<RespuestaPlantillaFormularioDto> {
    const original = await this.plantillaRepository.findOne({
      where: { id: plantillaId },
      relations: { campos: true },
    });

    if (!original) {
      throw new NotFoundException(`Plantilla ${plantillaId} no encontrada`);
    }

    const clonada = await this.dataSource.transaction(async (manager) => {
      const nuevaPlantilla = manager.create(PlantillaFormulario, {
        nombre: `${original.nombre} (copia)`,
        descripcion: original.descripcion,
        version: 1,
        estaActivo: false,
        subactividades: [],
        usuarios: [],
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

  private async resolverSubactividades(
    subactividadIds?: string[],
  ): Promise<Subactividad[]> {
    if (!subactividadIds?.length) {
      return [];
    }

    const subactividades = await this.subactividadRepository.findBy(
      subactividadIds.map((id) => ({ id })),
    );

    const idsEncontrados = new Set(subactividades.map((s) => s.id));
    const idsFaltantes = subactividadIds.filter(
      (id) => !idsEncontrados.has(id),
    );

    if (idsFaltantes.length) {
      throw new NotFoundException(
        `Subactividad(es) no encontrada(s): ${idsFaltantes.join(', ')}`,
      );
    }

    return subactividades;
  }

  private async resolverUsuarios(usuarioIds?: string[]): Promise<Usuario[]> {
    if (!usuarioIds?.length) {
      return [];
    }

    const usuarios = await this.usuarioRepository.findBy(
      usuarioIds.map((id) => ({ id })),
    );

    const idsEncontrados = new Set(usuarios.map((u) => u.id));
    const idsFaltantes = usuarioIds.filter((id) => !idsEncontrados.has(id));

    if (idsFaltantes.length) {
      throw new NotFoundException(
        `Usuario(s) no encontrado(s): ${idsFaltantes.join(', ')}`,
      );
    }

    return usuarios;
  }

  private async obtenerPlantilla(
    id: string,
  ): Promise<RespuestaPlantillaFormularioDto> {
    const plantilla = await this.plantillaRepository.findOne({
      where: { id },
      relations: { campos: true, subactividades: true, usuarios: true },
    });

    if (!plantilla) {
      throw new NotFoundException(`Plantilla ${id} no encontrada`);
    }

    return aRespuestaPlantilla(plantilla);
  }
}
