import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, In, Repository } from 'typeorm';
import { EntidadRevisable } from '../common/workflow/entidad-revisable.enum';
import { EstadoFuncional } from '../common/workflow/estado-funcional.enum';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { AlcanceTerritorialService } from '../usuarios/alcance-territorial.service';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  usuarioTieneAlgunPermiso,
  usuarioTienePermisos,
} from '../usuarios/utils/permisos-usuario';
import {
  candidatosDePaso,
  advertenciasNiveles,
  type PersonaPool,
} from './candidatos-aprobacion';
import { Approval } from './entities/approval.entity';
import { NivelAprobacionProyecto } from './entities/nivel-aprobacion-proyecto.entity';
import { PasoRevisionJornada } from './entities/paso-revision-jornada.entity';
import { EstadoRechazo, Rejection } from './entities/rejection.entity';
import { EstadoPasoRevision } from './enums/estado-paso-revision.enum';
import { ModoRevision } from './enums/modo-revision.enum';

/**
 * Quien tiene proyectos.editar y alcance sobre el proyecto puede reasignar el
 * paso pendiente a sí mismo y después aprobarlo, si no es el técnico de la
 * jornada ni aprobó otro nivel. Es la salida para desatorar la cadena, no un
 * permiso extra: aprobar sigue exigiendo jornadas.aprobar y las reglas del paso.
 */
export const REASIGNACION_A_SI_MISMO =
  'Quien edita el proyecto puede reasignarse el paso y luego aprobarlo, salvo que sea el técnico o ya haya aprobado otro nivel.';

const PERMISOS_DE_NIVEL = ['jornadas.aprobar', 'jornadas.rechazar'] as const;

export interface PasoSeguimiento {
  orden: number;
  estado: EstadoPasoRevision;
  tipo: 'USUARIO' | 'ROL';
  etiqueta: string;
  resueltoPor: string | null;
  contenidoCambio: boolean;
}

export interface SeguimientoJornada {
  modo: ModoRevision;
  pasos: PasoSeguimiento[];
  pasoPendiente: { orden: number; total: number } | null;
  puedeAprobar: boolean;
  puedeRechazar: boolean;
  sinCandidatos?: boolean;
}

interface Asignacion {
  usuarioId?: string | null;
  rolId?: string | null;
}

@Injectable()
export class CadenaRevisionService {
  constructor(
    @InjectRepository(NivelAprobacionProyecto)
    private readonly nivelRepo: Repository<NivelAprobacionProyecto>,
    @InjectRepository(PasoRevisionJornada)
    private readonly pasoRepo: Repository<PasoRevisionJornada>,
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
    private readonly alcanceTerritorialService: AlcanceTerritorialService,
  ) {}

  /**
   * Siempre la fila de la jornada primero. El paso se bloquea después, en este
   * orden, para no cruzarse con aprobar, rechazar, reasignar, enviar o reenviar.
   */
  async bloquearJornada(
    manager: EntityManager,
    jornadaId: string,
  ): Promise<Jornada> {
    const bloqueada = await manager
      .createQueryBuilder(Jornada, 'j')
      .setLock('pessimistic_write')
      .where('j.id = :id', { id: jornadaId })
      .getOne();
    if (!bloqueada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }
    const jornada = await manager.findOne(Jornada, {
      where: { id: jornadaId },
      relations: {
        proyecto: true,
        tecnicoResponsable: true,
        equipo: true,
      },
    });
    if (!jornada) {
      throw new NotFoundException(`Jornada ${jornadaId} no encontrada`);
    }
    return jornada;
  }

  async modo(
    manager: EntityManager,
    jornadaId: string,
  ): Promise<ModoRevision> {
    const pasos = await manager.count(PasoRevisionJornada, {
      where: { jornadaId },
    });
    return pasos > 0 ? ModoRevision.NIVELES : ModoRevision.LEGACY;
  }

  confirmarEnRevision(jornada: Jornada): void {
    if (jornada.estadoFuncional !== EstadoFuncional.EN_REVISION) {
      throw new BadRequestException(
        'La jornada ya no está en revisión. Vuelve a cargar la bandeja.',
      );
    }
  }

  /**
   * Inserta los pasos con ON CONFLICT DO NOTHING y después los lee.
   * Un choque de unique no aborta la transacción. Si la jornada ya estaba en
   * revisión sin pasos, sigue en LEGACY aunque el proyecto ya tenga cadena.
   */
  async capturarPasos(
    manager: EntityManager,
    jornada: Jornada,
    revisionNumero: number,
  ): Promise<PasoRevisionJornada[]> {
    const existentes = await manager.find(PasoRevisionJornada, {
      where: { jornadaId: jornada.id },
      order: { orden: 'ASC' },
    });
    if (
      existentes.length > 0 ||
      jornada.estadoFuncional === EstadoFuncional.EN_REVISION
    ) {
      return existentes;
    }

    const niveles = await manager.find(NivelAprobacionProyecto, {
      where: { proyectoId: jornada.proyecto.id },
      order: { orden: 'ASC' },
    });
    if (!niveles.length) return [];

    await manager
      .createQueryBuilder()
      .insert()
      .into(PasoRevisionJornada)
      .values(
        niveles.map((nivel) => ({
          id: randomUUID(),
          jornadaId: jornada.id,
          orden: nivel.orden,
          rolId: nivel.rolId,
          usuarioId: nivel.usuarioId,
          estado: EstadoPasoRevision.PENDIENTE,
          resueltoPor: null,
          resueltoEn: null,
          revisionNumero,
        })),
      )
      .orIgnore()
      .execute();

    return manager.find(PasoRevisionJornada, {
      where: { jornadaId: jornada.id },
      order: { orden: 'ASC' },
    });
  }

  async bloquearPasoPendiente(
    manager: EntityManager,
    jornadaId: string,
  ): Promise<PasoRevisionJornada> {
    const paso = await manager
      .createQueryBuilder(PasoRevisionJornada, 'p')
      .setLock('pessimistic_write')
      .where('p.jornadaId = :jornadaId', { jornadaId })
      .andWhere('p.estado = :estado', { estado: EstadoPasoRevision.PENDIENTE })
      .orderBy('p.orden', 'ASC')
      .getOne();
    if (!paso) {
      throw new BadRequestException(
        'Esta jornada no tiene un paso pendiente de revisión',
      );
    }
    return paso;
  }

  async marcarPaso(
    manager: EntityManager,
    paso: PasoRevisionJornada,
    estado: EstadoPasoRevision,
    usuarioId: string,
    revisionNumero: number,
  ): Promise<void> {
    const ahora = new Date();
    const resultado = await manager
      .createQueryBuilder()
      .update(PasoRevisionJornada)
      .set({
        estado,
        resueltoPor: usuarioId,
        resueltoEn: ahora,
        revisionNumero,
      })
      .where('id = :id AND estado = :pendiente', {
        id: paso.id,
        pendiente: EstadoPasoRevision.PENDIENTE,
      })
      .execute();
    if (!resultado.affected) {
      throw new ConflictException(
        'Alguien ya resolvió este nivel. Vuelve a cargar la bandeja.',
      );
    }
    paso.estado = estado;
    paso.resueltoPor = usuarioId;
    paso.resueltoEn = ahora;
    paso.revisionNumero = revisionNumero;
  }

  /**
   * Al reenviar, los pasos desde el nivel rechazado vuelven a pendiente.
   * La misma persona se decide con el historial de approvals.nivel, no con
   * resuelto_por, porque aquí se limpia.
   */
  async reiniciarDesdeNivel(
    manager: EntityManager,
    jornadaId: string,
    desdeOrden: number,
    revisionNumero: number,
  ): Promise<void> {
    await manager
      .createQueryBuilder(PasoRevisionJornada, 'p')
      .setLock('pessimistic_write')
      .where('p.jornadaId = :jornadaId', { jornadaId })
      .andWhere('p.orden >= :desdeOrden', { desdeOrden })
      .getMany();

    await manager
      .createQueryBuilder()
      .update(PasoRevisionJornada)
      .set({
        estado: EstadoPasoRevision.PENDIENTE,
        resueltoPor: null,
        resueltoEn: null,
        revisionNumero,
      })
      .where('jornadaId = :jornadaId AND orden >= :desdeOrden', {
        jornadaId,
        desdeOrden,
      })
      .execute();
  }

  async nivelRechazoAbierto(
    manager: EntityManager,
    jornadaId: string,
  ): Promise<number | null> {
    const rechazo = await manager.findOne(Rejection, {
      where: { jornadaId, status: EstadoRechazo.OPEN },
      order: { rejectedAt: 'DESC' },
    });
    if (rechazo?.nivel != null) return rechazo.nivel;

    const paso = await manager.findOne(PasoRevisionJornada, {
      where: { jornadaId, estado: EstadoPasoRevision.RECHAZADO },
      order: { orden: 'ASC' },
    });
    return paso?.orden ?? null;
  }

  async exigirCandidato(
    manager: EntityManager,
    jornada: Jornada,
    paso: PasoRevisionJornada,
    usuario: Usuario,
  ): Promise<void> {
    if (await this.actorPuede(manager, jornada, paso, usuario)) return;
    throw new ForbiddenException(
      'No puedes actuar este nivel: no eres candidato, eres el técnico o ya aprobaste otro nivel de esta jornada',
    );
  }

  /**
   * Coincide con la persona o el rol del paso, tiene acceso al proyecto y no
   * está excluido (técnico de la jornada u otro nivel ya aprobado).
   */
  async actorPuede(
    manager: EntityManager,
    jornada: Jornada,
    paso: PasoRevisionJornada,
    usuario: Usuario,
  ): Promise<boolean> {
    const excluir = await this.excluidos(manager, jornada, paso.orden);
    if (!this.coincide(usuario, paso, excluir)) return false;
    return this.alcanceTerritorialService.puedeGestionarProyecto(
      usuario,
      jornada.proyecto.id,
    );
  }

  async idsElegibles(
    manager: EntityManager,
    jornada: Jornada,
    paso: PasoRevisionJornada,
  ): Promise<Set<string>> {
    const personal = await this.personalDelProyecto(manager, jornada.proyecto.id);
    const excluir = await this.excluidos(manager, jornada, paso.orden);
    if (paso.usuarioId && !personal.some((p) => p.id === paso.usuarioId)) {
      const suelto = await this.persona(manager, paso.usuarioId);
      if (suelto) personal.push(suelto);
    }
    return new Set(
      candidatosDePaso(paso, personal, excluir).map((p) => p.id),
    );
  }

  /**
   * Reasignar usa el alcance del proyecto, no solo el permiso global.
   * Puede asignarse el paso a sí mismo: ver REASIGNACION_A_SI_MISMO.
   */
  async reasignar(
    manager: EntityManager,
    jornada: Jornada,
    usuario: Usuario,
    asignacion: Asignacion,
  ): Promise<{
    paso: PasoRevisionJornada;
    anterior: { usuarioId: string | null; rolId: string | null };
  }> {
    if (!usuarioTieneAlgunPermiso(usuario, ['proyectos.editar'])) {
      throw new ForbiddenException('No tienes permiso para reasignar la revisión');
    }
    await this.alcanceTerritorialService.assertPuedeGestionarProyecto(
      usuario,
      jornada.proyecto.id,
    );
    this.confirmarEnRevision(jornada);
    const paso = await this.bloquearPasoPendiente(manager, jornada.id);
    const anterior = { usuarioId: paso.usuarioId, rolId: paso.rolId };
    const usuarioId = asignacion.usuarioId ?? null;
    const rolId = asignacion.rolId ?? null;
    if (Boolean(usuarioId) === Boolean(rolId)) {
      throw new BadRequestException('Asigna una persona o un rol, no ambos');
    }

    if (usuarioId) {
      if (usuarioId === jornada.tecnicoResponsable?.id) {
        throw new BadRequestException(
          'No se puede asignar el paso al técnico de la jornada',
        );
      }
      const excluir = await this.excluidos(manager, jornada, paso.orden);
      if (excluir.has(usuarioId)) {
        throw new BadRequestException(
          'Esa persona ya aprobó otro nivel de esta jornada',
        );
      }
      const persona = await this.persona(manager, usuarioId);
      if (!persona?.activo) {
        throw new BadRequestException('Esa persona no está activa');
      }
      paso.usuarioId = usuarioId;
      paso.rolId = null;
    } else if (rolId) {
      paso.usuarioId = null;
      paso.rolId = rolId;
      const elegibles = await this.idsElegibles(manager, jornada, paso);
      if (elegibles.size === 0) {
        throw new BadRequestException(
          'Ese rol no tiene ningún candidato que pueda actuar este nivel',
        );
      }
    }

    const resultado = await manager
      .createQueryBuilder()
      .update(PasoRevisionJornada)
      .set({ usuarioId: paso.usuarioId, rolId: paso.rolId })
      .where('id = :id AND estado = :pendiente', {
        id: paso.id,
        pendiente: EstadoPasoRevision.PENDIENTE,
      })
      .execute();
    if (!resultado.affected) {
      throw new ConflictException(
        'Alguien ya resolvió este nivel. Vuelve a cargar la bandeja.',
      );
    }
    return { paso, anterior };
  }

  async guardarNiveles(
    proyectoId: string,
    usuario: Usuario,
    niveles: Array<{ orden: number; usuarioId?: string; rolId?: string }>,
  ): Promise<{ niveles: NivelAprobacionProyecto[]; advertencias: string[] }> {
    if (!usuarioTieneAlgunPermiso(usuario, ['proyectos.configurar_aprobaciones'])) {
      throw new ForbiddenException(
        'No tienes permiso para editar la cadena de aprobación',
      );
    }
    await this.alcanceTerritorialService.assertPuedeGestionarProyecto(
      usuario,
      proyectoId,
    );

    const normalizados = niveles
      .map((nivel) => ({
        orden: nivel.orden,
        usuarioId: nivel.usuarioId ?? null,
        rolId: nivel.rolId ?? null,
      }))
      .sort((a, b) => a.orden - b.orden);

    if (normalizados.length > 4) {
      throw new BadRequestException('Una cadena tiene como máximo 4 niveles');
    }
    const ordenes = new Set<number>();
    for (const nivel of normalizados) {
      if (ordenes.has(nivel.orden)) {
        throw new BadRequestException(`El orden ${nivel.orden} está repetido`);
      }
      ordenes.add(nivel.orden);
      if (Boolean(nivel.usuarioId) === Boolean(nivel.rolId)) {
        throw new BadRequestException(
          `El nivel ${nivel.orden} debe tener una persona o un rol`,
        );
      }
    }
    normalizados.forEach((nivel, indice) => {
      if (nivel.orden !== indice + 1) {
        throw new BadRequestException(
          'Los niveles deben ir del 1 en adelante, sin saltos',
        );
      }
    });
    for (const nivel of normalizados) {
      await this.validarAsignacionNivel(proyectoId, nivel);
    }

    const personal = await this.personalDelProyecto(
      this.nivelRepo.manager,
      proyectoId,
    );
    const advertencias = advertenciasNiveles(normalizados, personal);

    const guardados = await this.nivelRepo.manager.transaction(async (manager) => {
      await manager.delete(NivelAprobacionProyecto, { proyectoId });
      if (!normalizados.length) return [];
      return manager.save(
        NivelAprobacionProyecto,
        normalizados.map((nivel) =>
          manager.create(NivelAprobacionProyecto, {
            proyectoId,
            orden: nivel.orden,
            usuarioId: nivel.usuarioId,
            rolId: nivel.rolId,
          }),
        ),
      );
    });

    return { niveles: guardados, advertencias };
  }

  async listarNiveles(proyectoId: string): Promise<NivelAprobacionProyecto[]> {
    return this.nivelRepo.find({
      where: { proyectoId },
      order: { orden: 'ASC' },
    });
  }

  async indicadoresBandeja(
    usuario: Usuario,
    jornadas: Jornada[],
    esAprobadorLegacy: boolean,
  ): Promise<Map<string, SeguimientoJornada>> {
    const mapa = new Map<string, SeguimientoJornada>();
    if (!jornadas.length) return mapa;
    const ids = jornadas.map((j) => j.id);
    const pasos = await this.pasoRepo.find({
      where: { jornadaId: In(ids) },
      order: { orden: 'ASC' },
    });
    const porJornada = new Map<string, PasoRevisionJornada[]>();
    for (const paso of pasos) {
      const lista = porJornada.get(paso.jornadaId) ?? [];
      lista.push(paso);
      porJornada.set(paso.jornadaId, lista);
    }

    const puedeVerAtasco = usuarioTieneAlgunPermiso(usuario, [
      'proyectos.editar',
    ]);
    const atascadas = puedeVerAtasco
      ? jornadas.filter((j) => {
          const pendientes = (porJornada.get(j.id) ?? []).filter(
            (p) => p.estado === EstadoPasoRevision.PENDIENTE,
          );
          return (
            j.estadoFuncional === EstadoFuncional.EN_REVISION &&
            pendientes.length > 0
          );
        })
      : [];

    const sinCandidatos = new Map<string, boolean>();
    if (atascadas.length) {
      const proyectoIds = [...new Set(atascadas.map((j) => j.proyecto.id))];
      const personalPorProyecto = new Map<string, PersonaPool[]>();
      for (const proyectoId of proyectoIds) {
        personalPorProyecto.set(
          proyectoId,
          await this.personalDelProyecto(this.pasoRepo.manager, proyectoId),
        );
      }
      const approvals = await this.approvalRepo.find({
        where: {
          jornadaId: In(atascadas.map((j) => j.id)),
          entityType: EntidadRevisable.JORNADA,
        },
      });
      for (const jornada of atascadas) {
        const lista = porJornada.get(jornada.id) ?? [];
        const pendiente = lista.find(
          (p) => p.estado === EstadoPasoRevision.PENDIENTE,
        );
        if (!pendiente) continue;
        const excluir = new Set<string>();
        if (jornada.tecnicoResponsable?.id) {
          excluir.add(jornada.tecnicoResponsable.id);
        }
        for (const approval of approvals) {
          if (
            approval.jornadaId === jornada.id &&
            approval.nivel != null &&
            approval.nivel !== pendiente.orden
          ) {
            excluir.add(approval.approvedBy);
          }
        }
        const personal = [
          ...(personalPorProyecto.get(jornada.proyecto.id) ?? []),
        ];
        if (
          pendiente.usuarioId &&
          !personal.some((p) => p.id === pendiente.usuarioId)
        ) {
          const suelto = await this.persona(
            this.pasoRepo.manager,
            pendiente.usuarioId,
          );
          if (suelto) personal.push(suelto);
        }
        const delEquipo = candidatosDePaso(pendiente, personal, excluir);
        sinCandidatos.set(
          jornada.id,
          delEquipo.length === 0 &&
            !(await this.hayCandidatoConAcceso(
              jornada.proyecto.id,
              pendiente,
              excluir,
            )),
        );
      }
    }

    const { nombresUsuario, nombresRol } = await this.nombresDePasos(pasos);
    const approvals = ids.length
      ? await this.approvalRepo.find({
          where: {
            jornadaId: In(ids),
            entityType: EntidadRevisable.JORNADA,
          },
        })
      : [];
    const acceso = new Map<string, boolean>();
    const puedeAprobarPermiso = usuarioTieneAlgunPermiso(usuario, [
      'jornadas.aprobar',
    ]);
    const puedeRechazarPermiso = usuarioTieneAlgunPermiso(usuario, [
      'jornadas.rechazar',
    ]);

    for (const jornada of jornadas) {
      const lista = porJornada.get(jornada.id) ?? [];
      const pendiente = lista.find(
        (p) => p.estado === EstadoPasoRevision.PENDIENTE,
      );
      const enRevision =
        jornada.estadoFuncional === EstadoFuncional.EN_REVISION;
      let puedeActuar = false;
      if (enRevision && pendiente && jornada.proyecto?.id) {
        if (!acceso.has(jornada.proyecto.id)) {
          acceso.set(
            jornada.proyecto.id,
            await this.alcanceTerritorialService.puedeGestionarProyecto(
              usuario,
              jornada.proyecto.id,
            ),
          );
        }
        const excluir = this.excluirDe(jornada, pendiente.orden, approvals);
        puedeActuar =
          this.coincide(usuario, pendiente, excluir) &&
          acceso.get(jornada.proyecto.id) === true;
      }
      const legacy =
        lista.length === 0 && enRevision && esAprobadorLegacy;
      mapa.set(jornada.id, {
        modo: lista.length ? ModoRevision.NIVELES : ModoRevision.LEGACY,
        pasos: lista.map((paso) => this.pasoSeguimiento(paso, jornada, nombresUsuario, nombresRol)),
        pasoPendiente: pendiente
          ? { orden: pendiente.orden, total: lista.length }
          : null,
        puedeAprobar: lista.length
          ? puedeActuar && puedeAprobarPermiso
          : legacy && puedeAprobarPermiso,
        puedeRechazar: lista.length
          ? puedeActuar && puedeRechazarPermiso
          : legacy && puedeRechazarPermiso,
        ...(puedeVerAtasco
          ? { sinCandidatos: sinCandidatos.get(jornada.id) ?? false }
          : {}),
      });
    }
    return mapa;
  }

  private coincide(
    usuario: Usuario,
    paso: PasoRevisionJornada,
    excluir: Set<string>,
  ): boolean {
    if (excluir.has(usuario.id) || usuario.estaActivo === false) return false;
    if (paso.usuarioId) return paso.usuarioId === usuario.id;
    return (usuario.roles ?? []).some(
      (rol) => rol.estaActivo !== false && rol.id === paso.rolId,
    );
  }

  private excluirDe(
    jornada: Jornada,
    ordenActual: number,
    approvals: Approval[],
  ): Set<string> {
    const excluir = new Set<string>();
    if (jornada.tecnicoResponsable?.id) {
      excluir.add(jornada.tecnicoResponsable.id);
    }
    for (const approval of approvals) {
      if (
        approval.jornadaId === jornada.id &&
        approval.nivel != null &&
        approval.nivel !== ordenActual
      ) {
        excluir.add(approval.approvedBy);
      }
    }
    return excluir;
  }

  private pasoSeguimiento(
    paso: PasoRevisionJornada,
    jornada: Jornada,
    nombresUsuario: Map<string, string>,
    nombresRol: Map<string, string>,
  ): PasoSeguimiento {
    const tipo = paso.usuarioId ? 'USUARIO' : 'ROL';
    return {
      orden: paso.orden,
      estado: paso.estado,
      tipo,
      etiqueta: paso.usuarioId
        ? (nombresUsuario.get(paso.usuarioId) ?? 'Persona asignada')
        : (nombresRol.get(paso.rolId ?? '') ?? 'Rol asignado'),
      resueltoPor: paso.resueltoPor
        ? (nombresUsuario.get(paso.resueltoPor) ?? null)
        : null,
      contenidoCambio:
        paso.estado === EstadoPasoRevision.APROBADO &&
        paso.revisionNumero !== (jornada.revisionContenido ?? 0),
    };
  }

  private async nombresDePasos(pasos: PasoRevisionJornada[]): Promise<{
    nombresUsuario: Map<string, string>;
    nombresRol: Map<string, string>;
  }> {
    const usuarioIds = new Set<string>();
    const rolIds = new Set<string>();
    for (const paso of pasos) {
      if (paso.usuarioId) usuarioIds.add(paso.usuarioId);
      if (paso.resueltoPor) usuarioIds.add(paso.resueltoPor);
      if (paso.rolId) rolIds.add(paso.rolId);
    }
    const nombresUsuario = new Map<string, string>();
    const nombresRol = new Map<string, string>();
    if (usuarioIds.size) {
      const filas: Array<{ id: string; nombre_completo: string }> =
        await this.pasoRepo.manager.query(
          `SELECT id, nombre_completo FROM usuarios WHERE id = ANY($1::uuid[])`,
          [[...usuarioIds]],
        );
      for (const fila of filas) nombresUsuario.set(fila.id, fila.nombre_completo);
    }
    if (rolIds.size) {
      const filas: Array<{ id: string; nombre: string }> =
        await this.pasoRepo.manager.query(
          `SELECT id, nombre FROM roles WHERE id = ANY($1::uuid[])`,
          [[...rolIds]],
        );
      for (const fila of filas) nombresRol.set(fila.id, fila.nombre);
    }
    return { nombresUsuario, nombresRol };
  }

  private async validarAsignacionNivel(
    proyectoId: string,
    nivel: { orden: number; usuarioId: string | null; rolId: string | null },
  ): Promise<void> {
    if (nivel.usuarioId) {
      const persona = await this.nivelRepo.manager.findOne(Usuario, {
        where: { id: nivel.usuarioId },
        relations: { roles: { permisos: true } },
      });
      if (!persona || !persona.estaActivo || persona.eliminadoEn) {
        throw new BadRequestException(
          `El nivel ${nivel.orden} asigna a una persona que no está activa`,
        );
      }
      if (!usuarioTienePermisos(persona, [...PERMISOS_DE_NIVEL])) {
        throw new BadRequestException(
          `El nivel ${nivel.orden} necesita una persona que pueda aprobar y rechazar`,
        );
      }
      const puede = await this.alcanceTerritorialService.puedeGestionarProyecto(
        persona,
        proyectoId,
      );
      if (!puede) {
        throw new BadRequestException(
          `El nivel ${nivel.orden} asigna a alguien sin acceso a este proyecto`,
        );
      }
      return;
    }

    const rol = await this.nivelRepo.manager.findOne(Rol, {
      where: { id: nivel.rolId ?? undefined },
      relations: { permisos: true },
    });
    if (!rol || !rol.estaActivo) {
      throw new BadRequestException(
        `El nivel ${nivel.orden} usa un rol que no está activo`,
      );
    }
    const claves = new Set((rol.permisos ?? []).map((permiso) => permiso.clave));
    if (!PERMISOS_DE_NIVEL.every((clave) => claves.has(clave))) {
      throw new BadRequestException(
        `El nivel ${nivel.orden} usa un rol que no puede aprobar y rechazar`,
      );
    }
  }

  private async excluidos(
    manager: EntityManager,
    jornada: Jornada,
    ordenActual: number,
  ): Promise<Set<string>> {
    const excluir = new Set<string>();
    if (jornada.tecnicoResponsable?.id) {
      excluir.add(jornada.tecnicoResponsable.id);
    }
    const approvals = await manager.find(Approval, {
      where: { jornadaId: jornada.id, entityType: EntidadRevisable.JORNADA },
    });
    for (const approval of approvals) {
      if (approval.nivel != null && approval.nivel !== ordenActual) {
        excluir.add(approval.approvedBy);
      }
    }
    return excluir;
  }

  private async personalDelProyecto(
    manager: EntityManager,
    proyectoId: string,
  ): Promise<PersonaPool[]> {
    const filas: Array<{
      id: string;
      esta_activo: boolean;
      eliminado_en: Date | null;
      rol_id: string | null;
    }> = await manager.query(
      `SELECT u.id, u.esta_activo, u.eliminado_en, ur.rol_id
       FROM proyecto_personal pp
       JOIN usuarios u ON u.id = pp.usuario_id
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       WHERE pp.proyecto_id = $1`,
      [proyectoId],
    );
    const porId = new Map<string, PersonaPool>();
    for (const fila of filas) {
      const actual = porId.get(fila.id) ?? {
        id: fila.id,
        rolIds: [],
        activo: fila.esta_activo && fila.eliminado_en == null,
      };
      if (fila.rol_id) actual.rolIds.push(fila.rol_id);
      porId.set(fila.id, actual);
    }
    return [...porId.values()];
  }

  private async persona(
    manager: EntityManager,
    usuarioId: string,
  ): Promise<PersonaPool | null> {
    const filas: Array<{
      id: string;
      esta_activo: boolean;
      eliminado_en: Date | null;
      rol_id: string | null;
    }> = await manager.query(
      `SELECT u.id, u.esta_activo, u.eliminado_en, ur.rol_id
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       WHERE u.id = $1`,
      [usuarioId],
    );
    if (!filas.length) return null;
    return {
      id: usuarioId,
      rolIds: filas.map((f) => f.rol_id).filter((id): id is string => Boolean(id)),
      activo: filas[0].esta_activo && filas[0].eliminado_en == null,
    };
  }

  /** Si el equipo no alcanza, busca a quien tenga el rol o sea la persona y pueda gestionar el proyecto. */
  private async hayCandidatoConAcceso(
    proyectoId: string,
    paso: PasoRevisionJornada,
    excluir: Set<string>,
  ): Promise<boolean> {
    const filas: Array<{ id: string }> = await this.pasoRepo.manager.query(
      `SELECT DISTINCT u.id
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       WHERE u.esta_activo = true
         AND u.eliminado_en IS NULL
         AND (
           ($1::uuid IS NOT NULL AND u.id = $1::uuid)
           OR ($2::uuid IS NOT NULL AND ur.rol_id = $2::uuid)
         )`,
      [paso.usuarioId, paso.rolId],
    );
    for (const fila of filas) {
      if (excluir.has(fila.id)) continue;
      const persona = await this.pasoRepo.manager.findOne(Usuario, {
        where: { id: fila.id },
        relations: { roles: true },
      });
      if (!persona) continue;
      if (
        await this.alcanceTerritorialService.puedeGestionarProyecto(
          persona,
          proyectoId,
        )
      ) {
        return true;
      }
    }
    return false;
  }
}
