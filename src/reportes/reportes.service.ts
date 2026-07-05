import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actividad } from '../actividades/entities/actividad.entity';
import { Subactividad } from '../actividades/entities/subactividad.entity';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { EnvioFormulario } from '../formularios/entities/envio-formulario.entity';
import { PlantillaFormulario } from '../formularios/entities/plantilla-formulario.entity';
import { Jornada } from '../jornadas/entities/jornada.entity';
import { EstadoJornada } from '../jornadas/enums/estado-jornada.enum';
import { Proyecto } from '../proyectos/entities/proyecto.entity';
import { FiltrosReporteBeneficiariosDto } from './dto/reportes.dto';

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Proyecto)
    private readonly proyectoRepository: Repository<Proyecto>,
    @InjectRepository(Jornada)
    private readonly jornadaRepository: Repository<Jornada>,
    @InjectRepository(Beneficiario)
    private readonly beneficiarioRepository: Repository<Beneficiario>,
    @InjectRepository(EnvioFormulario)
    private readonly envioRepository: Repository<EnvioFormulario>,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
    @InjectRepository(Actividad)
    private readonly actividadRepository: Repository<Actividad>,
    @InjectRepository(Subactividad)
    private readonly subactividadRepository: Repository<Subactividad>,
    @InjectRepository(PlantillaFormulario)
    private readonly plantillaRepository: Repository<PlantillaFormulario>,
  ) {}

  async resumenProyecto(proyectoId: string) {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
      relations: { creador: true, veredas: true, personal: true },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }

    const conteoJornadas = await this.jornadaRepository.countBy({
      proyecto: { id: proyectoId },
    });

    const conteoBeneficiarios = await this.proyectoRepository
      .createQueryBuilder('proyecto')
      .innerJoin('proyecto.proyectoBeneficiarios', 'pb')
      .where('proyecto.id = :proyectoId', { proyectoId })
      .getCount();

    const conteoFormularios = await this.envioRepository
      .createQueryBuilder('envio')
      .innerJoin('envio.jornada', 'jornada')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .getCount();

    const conteoEvidencias = await this.evidenciaRepository
      .createQueryBuilder('evidencia')
      .innerJoin('evidencia.jornada', 'jornada')
      .where('jornada.proyecto_id = :proyectoId', { proyectoId })
      .getCount();

    const conteoActividades = await this.actividadRepository.countBy({
      proyecto: { id: proyectoId },
    });

    return {
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.nombre,
        tipo: proyecto.tipo,
        estado: proyecto.estado,
        fechaInicio: proyecto.fechaInicio,
        fechaFin: proyecto.fechaFin,
      },
      territoriosCubiertos: proyecto.veredas?.length ?? 0,
      veredas: proyecto.veredas?.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        codigo: v.codigo,
      })),
      personal: proyecto.personal?.map((u) => ({
        id: u.id,
        nombreCompleto: u.nombreCompleto,
        correo: u.correo,
      })),
      conteos: {
        jornadas: conteoJornadas,
        beneficiarios: conteoBeneficiarios,
        formularios: conteoFormularios,
        evidencias: conteoEvidencias,
        actividades: conteoActividades,
      },
    };
  }

  async reporteBeneficiarios(
    proyectoId: string,
    filtros: FiltrosReporteBeneficiariosDto,
  ) {
    await this.verificarProyecto(proyectoId);

    const query = this.beneficiarioRepository
      .createQueryBuilder('beneficiario')
      .innerJoin('beneficiario.proyectos', 'proyecto', 'proyecto.id = :proyectoId', {
        proyectoId,
      })
      .leftJoinAndSelect('beneficiario.vereda', 'vereda');

    if (filtros.veredaId) {
      query.andWhere('beneficiario.vereda_id = :veredaId', {
        veredaId: filtros.veredaId,
      });
    }

    if (filtros.busqueda) {
      query.andWhere(
        '(beneficiario.nombres ILIKE :busqueda OR beneficiario.apellidos ILIKE :busqueda OR beneficiario.numero_documento ILIKE :busqueda)',
        { busqueda: `%${filtros.busqueda}%` },
      );
    }

    const beneficiarios = await query.getMany();
    const resultado: Record<string, unknown>[] = [];

    for (const beneficiario of beneficiarios) {
      const jornadasAtendidas = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .innerJoin('jornada.beneficiarios', 'b', 'b.id = :beneficiarioId', {
          beneficiarioId: beneficiario.id,
        })
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .getCount();

      resultado.push({
        id: beneficiario.id,
        nombres: beneficiario.nombres,
        apellidos: beneficiario.apellidos,
        numeroDocumento: beneficiario.numeroDocumento,
        vereda: beneficiario.vereda?.nombre,
        jornadasAtendidas,
        formularios: jornadasAtendidas,
        documentos: beneficiario.numeroDocumento,
      });
    }

    return resultado;
  }

  async avanceActividades(proyectoId: string) {
    await this.verificarProyecto(proyectoId);

    const actividades = await this.actividadRepository.find({
      where: { proyecto: { id: proyectoId } },
      relations: { subactividades: true },
    });

    const resultado: Record<string, unknown>[] = [];

    for (const actividad of actividades) {
      const jornadasPlanificadas = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .innerJoin('jornada.jornadaActividades', 'ja')
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .andWhere('ja.actividad_id = :actividadId', { actividadId: actividad.id })
        .andWhere('jornada.estado = :estado', { estado: EstadoJornada.PLANIFICADA })
        .getCount();

      const jornadasEjecutadas = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .innerJoin('jornada.jornadaActividades', 'ja')
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .andWhere('ja.actividad_id = :actividadId', { actividadId: actividad.id })
        .andWhere('jornada.estado IN (:...estados)', {
          estados: [EstadoJornada.COMPLETADA, EstadoJornada.EN_PROGRESO],
        })
        .getCount();

      const subactividadesDetalle: Record<string, unknown>[] = [];

      for (const sub of actividad.subactividades ?? []) {
        const plantillasActivas = await this.plantillaRepository.countBy({
          subactividad: { id: sub.id },
          estaActivo: true,
        });

        const formulariosRecibidos = await this.envioRepository
          .createQueryBuilder('envio')
          .innerJoin('envio.jornada', 'jornada')
          .innerJoin('envio.plantillaFormulario', 'plantilla')
          .where('jornada.proyecto_id = :proyectoId', { proyectoId })
          .andWhere('plantilla.subactividad_id = :subactividadId', {
            subactividadId: sub.id,
          })
          .getCount();

        subactividadesDetalle.push({
          id: sub.id,
          nombre: sub.nombre,
          formulariosEsperados: plantillasActivas,
          formulariosRecibidos,
        });
      }

      resultado.push({
        actividadId: actividad.id,
        actividadNombre: actividad.nombre,
        jornadasPlanificadas,
        jornadasEjecutadas,
        subactividades: subactividadesDetalle,
      });
    }

    return resultado;
  }

  async mapaCalorTerritorio(proyectoId: string) {
    const proyecto = await this.proyectoRepository.findOne({
      where: { id: proyectoId },
      relations: { veredas: true },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }

    const veredaIds = proyecto.veredas?.map((v) => v.id) ?? [];

    if (!veredaIds.length) {
      return [];
    }

    const resultado: Record<string, unknown>[] = [];

    for (const vereda of proyecto.veredas ?? []) {
      const conteoBeneficiarios = await this.beneficiarioRepository.countBy({
        vereda: { id: vereda.id },
      });

      const conteoJornadas = await this.jornadaRepository.countBy({
        proyecto: { id: proyectoId },
        vereda: { id: vereda.id },
      });

      const centroide = await this.jornadaRepository
        .createQueryBuilder('jornada')
        .select('AVG(jornada.latitud)', 'latitud')
        .addSelect('AVG(jornada.longitud)', 'longitud')
        .where('jornada.proyecto_id = :proyectoId', { proyectoId })
        .andWhere('jornada.vereda_id = :veredaId', { veredaId: vereda.id })
        .andWhere('jornada.latitud IS NOT NULL')
        .getRawOne<{ latitud: string; longitud: string }>();

      resultado.push({
        veredaId: vereda.id,
        veredaNombre: vereda.nombre,
        veredaCodigo: vereda.codigo,
        conteoBeneficiarios,
        conteoJornadas,
        latitud: centroide?.latitud ? Number(centroide.latitud) : null,
        longitud: centroide?.longitud ? Number(centroide.longitud) : null,
      });
    }

    return resultado;
  }

  private async verificarProyecto(proyectoId: string): Promise<void> {
    const existe = await this.proyectoRepository.existsBy({ id: proyectoId });

    if (!existe) {
      throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    }
  }
}
