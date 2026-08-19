import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CATALOGO_WIDGETS } from './catalogo-widgets';
import { WidgetDashboard } from './entities/widget-dashboard.entity';

@Injectable()
export class WidgetsDashboardSeedService implements OnModuleInit {
  private readonly logger = new Logger(WidgetsDashboardSeedService.name);

  constructor(
    @InjectRepository(WidgetDashboard)
    private readonly widgetRepository: Repository<WidgetDashboard>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.asegurarCatalogo();
  }

  private async asegurarCatalogo(): Promise<void> {
    for (const def of CATALOGO_WIDGETS) {
      const existente = await this.widgetRepository.findOne({
        where: { clave: def.clave },
      });
      if (existente) {
        existente.titulo = def.titulo;
        existente.descripcion = def.descripcion;
        existente.tipo = def.tipo;
        existente.permisoRequerido = def.permisoRequerido;
        existente.tamanosPermitidos = def.tamanosPermitidos;
        existente.tamanoPorDefecto = def.tamanoPorDefecto;
        existente.orden = def.orden;
        existente.estaActivo = true;
        await this.widgetRepository.save(existente);
      } else {
        await this.widgetRepository.save(
          this.widgetRepository.create({
            clave: def.clave,
            titulo: def.titulo,
            descripcion: def.descripcion,
            tipo: def.tipo,
            permisoRequerido: def.permisoRequerido,
            tamanosPermitidos: def.tamanosPermitidos,
            tamanoPorDefecto: def.tamanoPorDefecto,
            orden: def.orden,
            estaActivo: true,
          }),
        );
      }
    }

    // Desactiva widgets que ya no están en el catálogo de código (no se eliminan
    // para no romper preferencias guardadas; se filtran en tiempo de lectura).
    const clavesVigentes = new Set(CATALOGO_WIDGETS.map((w) => w.clave));
    const todos = await this.widgetRepository.find();
    const obsoletos = todos.filter(
      (w) => !clavesVigentes.has(w.clave) && w.estaActivo,
    );
    for (const w of obsoletos) {
      w.estaActivo = false;
      await this.widgetRepository.save(w);
      this.logger.warn(`Widget desactivado (fuera de catálogo): ${w.clave}`);
    }
  }
}
