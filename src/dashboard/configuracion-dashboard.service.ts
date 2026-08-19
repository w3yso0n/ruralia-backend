import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ordenJerarquiaRol } from '../usuarios/catalogo-permisos';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { obtenerPermisosEfectivos } from '../usuarios/utils/permisos-usuario';
import { LAYOUT_POR_DEFECTO } from './catalogo-widgets';
import {
  ActualizarConfiguracionDashboardDto,
  ConfiguracionDashboardDto,
  ItemPreferenciaDashboardDto,
  WidgetDisponibleDto,
} from './dto/widget-dashboard.dto';
import { AsignacionPlantillaRol } from './entities/asignacion-plantilla-rol.entity';
import { PreferenciaDashboardUsuario } from './entities/preferencia-dashboard-usuario.entity';
import { WidgetDashboard } from './entities/widget-dashboard.entity';

@Injectable()
export class ConfiguracionDashboardService {
  constructor(
    @InjectRepository(WidgetDashboard)
    private readonly widgetRepository: Repository<WidgetDashboard>,
    @InjectRepository(PreferenciaDashboardUsuario)
    private readonly preferenciaRepository: Repository<PreferenciaDashboardUsuario>,
    @InjectRepository(AsignacionPlantillaRol)
    private readonly asignacionPlantillaRepository: Repository<AsignacionPlantillaRol>,
  ) {}

  /** Widgets del catálogo que el usuario tiene permiso de ver/agregar. */
  async obtenerDisponibles(usuario: Usuario): Promise<WidgetDisponibleDto[]> {
    const permisos = new Set(obtenerPermisosEfectivos(usuario));
    const widgets = await this.widgetRepository.find({
      where: { estaActivo: true },
      order: { orden: 'ASC' },
    });

    return widgets
      .filter((w) => !w.permisoRequerido || permisos.has(w.permisoRequerido))
      .map((w) => ({
        clave: w.clave,
        titulo: w.titulo,
        descripcion: w.descripcion,
        tipo: w.tipo,
        tamanosPermitidos: w.tamanosPermitidos,
        tamanoPorDefecto: w.tamanoPorDefecto,
      }));
  }

  /**
   * Layout efectivo del usuario, en este orden de prioridad:
   *  1. Configuración propia guardada (si alguna vez guardó algo con
   *     `configuracion.editar_dashboard`).
   *  2. Plantilla asignada al rol de mayor jerarquía del usuario, si existe
   *     una (aplica tanto si el usuario puede editar como si no: si puede
   *     editar, la plantilla es su punto de partida hasta que guarde algo
   *     propio; si no puede editar, la plantilla es fija).
   *  3. Layout de fábrica calculado del catálogo (fallback histórico).
   */
  async obtenerConfiguracion(
    usuario: Usuario,
  ): Promise<ConfiguracionDashboardDto> {
    const disponibles = await this.obtenerDisponibles(usuario);
    const porClave = new Map(disponibles.map((w) => [w.clave, w]));

    const guardadas = await this.preferenciaRepository.find({
      where: { usuario: { id: usuario.id } },
      order: { posicion: 'ASC' },
    });

    if (guardadas.length > 0) {
      return {
        esPorDefecto: false,
        origen: 'PROPIA',
        items: this.saneaItems(guardadas, porClave),
      };
    }

    const plantilla = await this.resolverPlantillaDelUsuario(usuario);
    if (plantilla) {
      return {
        esPorDefecto: false,
        origen: 'PLANTILLA',
        items: this.saneaItems(plantilla.items, porClave),
      };
    }

    const porDefecto = LAYOUT_POR_DEFECTO.filter((w) => porClave.has(w.clave));
    return {
      esPorDefecto: true,
      origen: 'FABRICA',
      items: porDefecto.map((w, i) => ({
        widgetClave: w.clave,
        posicion: i,
        tamano: w.tamano,
        visible: true,
      })),
    };
  }

  async actualizarConfiguracion(
    usuario: Usuario,
    dto: ActualizarConfiguracionDashboardDto,
  ): Promise<ConfiguracionDashboardDto> {
    const disponibles = await this.obtenerDisponibles(usuario);
    const porClave = new Map(disponibles.map((w) => [w.clave, w]));

    for (const item of dto.items) {
      const widget = porClave.get(item.widgetClave);
      if (!widget) {
        throw new BadRequestException(
          `Widget no disponible para este usuario: ${item.widgetClave}`,
        );
      }
      if (!widget.tamanosPermitidos.includes(item.tamano)) {
        throw new BadRequestException(
          `Tamaño no permitido para ${item.widgetClave}: ${item.tamano}`,
        );
      }
    }

    const clavesEnviadas = new Set(dto.items.map((i) => i.widgetClave));
    if (clavesEnviadas.size !== dto.items.length) {
      throw new BadRequestException('Widgets duplicados en la configuración');
    }

    await this.preferenciaRepository.delete({ usuario: { id: usuario.id } });

    if (dto.items.length > 0) {
      const filas = dto.items.map((item) =>
        this.preferenciaRepository.create({
          usuario: { id: usuario.id } as Usuario,
          widgetClave: item.widgetClave,
          posicion: item.posicion,
          tamano: item.tamano,
          visible: item.visible,
        }),
      );
      await this.preferenciaRepository.save(filas);
    }

    return this.obtenerConfiguracion(usuario);
  }

  /**
   * Borra la configuración propia del usuario. La siguiente lectura vuelve a
   * resolver desde la plantilla de su rol (si tiene una asignada) o el
   * layout de fábrica — no hay forma de "romper" el vínculo con la
   * plantilla salvo guardando una configuración propia de nuevo.
   */
  async restablecerConfiguracion(
    usuario: Usuario,
  ): Promise<ConfiguracionDashboardDto> {
    await this.preferenciaRepository.delete({ usuario: { id: usuario.id } });
    return this.obtenerConfiguracion(usuario);
  }

  /**
   * Entre los roles del usuario que tienen una plantilla asignada, devuelve
   * la del rol de mayor jerarquía (ver `ordenJerarquiaRol`). `undefined` si
   * ninguno de sus roles tiene plantilla asignada.
   */
  private async resolverPlantillaDelUsuario(usuario: Usuario) {
    const rolesIds = (usuario.roles ?? [])
      .filter((r) => r.estaActivo !== false)
      .map((r) => r.id);
    if (rolesIds.length === 0) return undefined;

    const asignaciones = await this.asignacionPlantillaRepository.find({
      where: rolesIds.map((id) => ({ rol: { id } })),
      relations: { rol: true, plantilla: { items: true } },
    });
    if (asignaciones.length === 0) return undefined;

    asignaciones.sort(
      (a, b) =>
        ordenJerarquiaRol(a.rol.nombre) - ordenJerarquiaRol(b.rol.nombre),
    );
    return asignaciones[0].plantilla;
  }

  /**
   * Filtra items a los que el usuario ya no tiene acceso (widget fuera del
   * catálogo disponible) y sanea tamaños que hayan quedado obsoletos por un
   * cambio de catálogo, cayendo al tamaño por defecto vigente.
   */
  private saneaItems(
    items: {
      widgetClave: string;
      posicion: number;
      tamano: string;
      visible: boolean;
    }[],
    porClave: Map<string, WidgetDisponibleDto>,
  ): ItemPreferenciaDashboardDto[] {
    return items
      .filter((i) => porClave.has(i.widgetClave))
      .map((i) => {
        const widget = porClave.get(i.widgetClave)!;
        const tamano = widget.tamanosPermitidos.includes(i.tamano as never)
          ? (i.tamano as WidgetDisponibleDto['tamanoPorDefecto'])
          : widget.tamanoPorDefecto;
        return {
          widgetClave: i.widgetClave,
          posicion: i.posicion,
          tamano,
          visible: i.visible,
        };
      });
  }
}
