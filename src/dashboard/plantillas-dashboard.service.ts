import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from '../usuarios/entities/rol.entity';
import { AsignacionPlantillaRol } from './entities/asignacion-plantilla-rol.entity';
import { ItemPlantillaDashboard } from './entities/item-plantilla-dashboard.entity';
import { PlantillaDashboard } from './entities/plantilla-dashboard.entity';
import { WidgetDashboard } from './entities/widget-dashboard.entity';
import {
  ActualizarPlantillaDashboardDto,
  CompatibilidadRolWidgetDto,
  CrearPlantillaDashboardDto,
  PlantillaDashboardDto,
} from './dto/plantilla-dashboard.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Injectable()
export class PlantillasDashboardService {
  constructor(
    @InjectRepository(PlantillaDashboard)
    private readonly plantillaRepository: Repository<PlantillaDashboard>,
    @InjectRepository(ItemPlantillaDashboard)
    private readonly itemRepository: Repository<ItemPlantillaDashboard>,
    @InjectRepository(AsignacionPlantillaRol)
    private readonly asignacionRepository: Repository<AsignacionPlantillaRol>,
    @InjectRepository(WidgetDashboard)
    private readonly widgetRepository: Repository<WidgetDashboard>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  async listar(): Promise<PlantillaDashboardDto[]> {
    const plantillas = await this.plantillaRepository.find({
      relations: { items: true },
      order: { actualizadoEn: 'DESC' },
    });
    const asignaciones = await this.asignacionRepository.find({
      relations: { rol: true, plantilla: true },
    });
    return plantillas.map((p) => this.aDto(p, asignaciones));
  }

  async obtenerUna(id: string): Promise<PlantillaDashboardDto> {
    const plantilla = await this.buscar(id);
    const asignaciones = await this.asignacionRepository.find({
      where: { plantilla: { id } },
      relations: { rol: true, plantilla: true },
    });
    return this.aDto(plantilla, asignaciones);
  }

  async crear(
    usuario: Usuario,
    dto: CrearPlantillaDashboardDto,
  ): Promise<PlantillaDashboardDto> {
    await this.validarItems(dto.items);

    const plantilla = this.plantillaRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      creadoPor: usuario,
      items: dto.items.map((item) =>
        this.itemRepository.create({
          widgetClave: item.widgetClave,
          posicion: item.posicion,
          tamano: item.tamano,
          visible: item.visible,
        }),
      ),
    });
    const guardada = await this.plantillaRepository.save(plantilla);
    return this.obtenerUna(guardada.id);
  }

  async actualizar(
    id: string,
    dto: ActualizarPlantillaDashboardDto,
  ): Promise<PlantillaDashboardDto> {
    const plantilla = await this.buscar(id);

    if (dto.nombre !== undefined) plantilla.nombre = dto.nombre;
    if (dto.descripcion !== undefined) plantilla.descripcion = dto.descripcion;

    if (dto.items) {
      await this.validarItems(dto.items);
      await this.itemRepository.delete({ plantilla: { id } });
      plantilla.items = dto.items.map((item) =>
        this.itemRepository.create({
          plantilla: { id } as PlantillaDashboard,
          widgetClave: item.widgetClave,
          posicion: item.posicion,
          tamano: item.tamano,
          visible: item.visible,
        }),
      );
    }

    await this.plantillaRepository.save(plantilla);
    return this.obtenerUna(id);
  }

  async eliminar(id: string): Promise<void> {
    const plantilla = await this.buscar(id);
    await this.plantillaRepository.remove(plantilla);
  }

  async asignarARol(plantillaId: string, rolId: string): Promise<void> {
    const plantilla = await this.buscar(plantillaId);
    const rol = await this.rolRepository.findOne({ where: { id: rolId } });
    if (!rol) throw new NotFoundException('Rol no encontrado');

    const existente = await this.asignacionRepository.findOne({
      where: { rol: { id: rolId } },
    });
    if (existente) {
      existente.plantilla = plantilla;
      await this.asignacionRepository.save(existente);
      return;
    }

    await this.asignacionRepository.save(
      this.asignacionRepository.create({ rol, plantilla }),
    );
  }

  async quitarAsignacion(rolId: string): Promise<void> {
    await this.asignacionRepository.delete({ rol: { id: rolId } });
  }

  /**
   * Para el editor de plantillas: por cada widget del catálogo, qué roles
   * de sistema/personalizados cumplen (ahora mismo) el permiso requerido.
   * Permite al admin ver si un widget tiene sentido para el rol al que
   * piensa asignar la plantilla, en tiempo real.
   */
  async obtenerCompatibilidadRoles(): Promise<CompatibilidadRolWidgetDto[]> {
    const [widgets, roles] = await Promise.all([
      this.widgetRepository.find({
        where: { estaActivo: true },
        order: { orden: 'ASC' },
      }),
      this.rolRepository.find({
        where: { estaActivo: true },
        relations: { permisos: true },
        order: { nombre: 'ASC' },
      }),
    ]);

    return widgets.map((widget) => {
      const compatibles: Rol[] = [];
      const incompatibles: Rol[] = [];
      for (const rol of roles) {
        const tienePermiso =
          !widget.permisoRequerido ||
          (rol.permisos ?? []).some((p) => p.clave === widget.permisoRequerido);
        (tienePermiso ? compatibles : incompatibles).push(rol);
      }
      return {
        widgetClave: widget.clave,
        permisoRequerido: widget.permisoRequerido ?? undefined,
        rolesCompatibles: compatibles.map((r) => ({
          id: r.id,
          nombre: r.nombre,
        })),
        rolesIncompatibles: incompatibles.map((r) => ({
          id: r.id,
          nombre: r.nombre,
        })),
      };
    });
  }

  private async validarItems(
    items: { widgetClave: string; tamano: string }[],
  ): Promise<void> {
    if (!items.length) return;
    const claves = new Set(items.map((i) => i.widgetClave));
    if (claves.size !== items.length) {
      throw new BadRequestException('Widgets duplicados en la plantilla');
    }
    const widgets = await this.widgetRepository.find({
      where: { estaActivo: true },
    });
    const porClave = new Map(widgets.map((w) => [w.clave, w]));
    for (const item of items) {
      const widget = porClave.get(item.widgetClave);
      if (!widget) {
        throw new BadRequestException(
          `Widget no disponible: ${item.widgetClave}`,
        );
      }
      if (!widget.tamanosPermitidos.includes(item.tamano as never)) {
        throw new BadRequestException(
          `Tamaño no permitido para ${item.widgetClave}: ${item.tamano}`,
        );
      }
    }
  }

  private async buscar(id: string): Promise<PlantillaDashboard> {
    const plantilla = await this.plantillaRepository.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada');
    return plantilla;
  }

  private aDto(
    plantilla: PlantillaDashboard,
    todasLasAsignaciones: AsignacionPlantillaRol[],
  ): PlantillaDashboardDto {
    const rolesAsignados = todasLasAsignaciones
      .filter((a) => a.plantilla.id === plantilla.id)
      .map((a) => ({ id: a.rol.id, nombre: a.rol.nombre }));

    return {
      id: plantilla.id,
      nombre: plantilla.nombre,
      descripcion: plantilla.descripcion,
      items: (plantilla.items ?? [])
        .sort((a, b) => a.posicion - b.posicion)
        .map((i) => ({
          widgetClave: i.widgetClave,
          posicion: i.posicion,
          tamano: i.tamano,
          visible: i.visible,
        })),
      rolesAsignados,
      creadoEn: plantilla.creadoEn,
      actualizadoEn: plantilla.actualizadoEn,
    };
  }
}
