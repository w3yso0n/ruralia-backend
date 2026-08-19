import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { obtenerPermisosEfectivos } from '../usuarios/utils/permisos-usuario';
import { LAYOUT_POR_DEFECTO } from './catalogo-widgets';
import {
  ActualizarConfiguracionDashboardDto,
  ConfiguracionDashboardDto,
  WidgetDisponibleDto,
} from './dto/widget-dashboard.dto';
import { PreferenciaDashboardUsuario } from './entities/preferencia-dashboard-usuario.entity';
import { WidgetDashboard } from './entities/widget-dashboard.entity';

@Injectable()
export class ConfiguracionDashboardService {
  constructor(
    @InjectRepository(WidgetDashboard)
    private readonly widgetRepository: Repository<WidgetDashboard>,
    @InjectRepository(PreferenciaDashboardUsuario)
    private readonly preferenciaRepository: Repository<PreferenciaDashboardUsuario>,
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

  /** Layout guardado del usuario, o el de fábrica (filtrado por permisos) si nunca configuró. */
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
        items: guardadas
          .filter((p) => porClave.has(p.widgetClave))
          .map((p) => {
            const widget = porClave.get(p.widgetClave)!;
            // Si el tamaño guardado quedó obsoleto (el catálogo cambió), se sanea
            // al tamaño por defecto vigente en vez de arrastrar un valor inválido.
            const tamano = widget.tamanosPermitidos.includes(p.tamano)
              ? p.tamano
              : widget.tamanoPorDefecto;
            return {
              widgetClave: p.widgetClave,
              posicion: p.posicion,
              tamano,
              visible: p.visible,
            };
          }),
      };
    }

    const porDefecto = LAYOUT_POR_DEFECTO.filter((w) => porClave.has(w.clave));

    return {
      esPorDefecto: true,
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

  async restablecerConfiguracion(
    usuario: Usuario,
  ): Promise<ConfiguracionDashboardDto> {
    await this.preferenciaRepository.delete({ usuario: { id: usuario.id } });
    return this.obtenerConfiguracion(usuario);
  }
}
