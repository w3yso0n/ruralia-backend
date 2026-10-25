import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Beneficiario } from '../beneficiarios/entities/beneficiario.entity';
import { CampoBeneficiario } from '../beneficiarios/entities/campo-beneficiario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { TipoPlantilla } from './enums/tipo-plantilla.enum';
import { PlantillasFormularioService } from './plantillas-formulario.service';
import {
  CampoConAutocompletado,
  ContextoAutocompletado,
  ORIGENES_FICHA,
  OrigenAutocompletado,
  ValorAutocompletado,
  origenDeDatoAdicional,
  plantillaEsPorPersona,
  tablaTieneAutocompletado,
  valoresParaPersona,
} from './utils/autocompletado';

export interface OrigenesAutocompletado {
  ficha: OrigenAutocompletado[];
  adicionales: OrigenAutocompletado[];
}

export interface AutocompletadoPlantillaJornada {
  /** Un formulario por cada beneficiario de la jornada. */
  porPersona: boolean;
  /** Tablas con una fila fija por beneficiario de la jornada. */
  tablasFijas: string[];
  valores: Record<
    string,
    {
      campos: Record<string, ValorAutocompletado>;
      columnas: Record<string, Record<string, ValorAutocompletado>>;
    }
  >;
}

export interface AutocompletadoJornada {
  beneficiarios: Array<{ id: string; nombre: string; numeroDocumento: string }>;
  plantillas: Record<string, AutocompletadoPlantillaJornada>;
}

@Injectable()
export class AutocompletadoFormularioService {
  constructor(
    @InjectRepository(Beneficiario)
    private readonly beneficiarioRepository: Repository<Beneficiario>,
    @InjectRepository(CampoBeneficiario)
    private readonly campoBeneficiarioRepository: Repository<CampoBeneficiario>,
    private readonly plantillasService: PlantillasFormularioService,
  ) {}

  /** Lo que se puede elegir en el editor: ficha y datos adicionales del catálogo. */
  async listarOrigenes(): Promise<OrigenesAutocompletado> {
    const adicionales = await this.campoBeneficiarioRepository.find({
      where: { proyecto: IsNull() },
      order: { etiqueta: 'ASC' },
    });
    return {
      ficha: ORIGENES_FICHA,
      adicionales: adicionales.map((campo) => ({
        origen: origenDeDatoAdicional(campo.clave),
        etiqueta: campo.etiqueta,
        tipo: campo.tipo,
        grupo: 'adicional',
      })),
    };
  }

  /** Personas de la jornada con lo necesario para resolver valores, en orden alfabético. */
  async beneficiariosDeJornada(jornadaId: string): Promise<Beneficiario[]> {
    return this.beneficiarioRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.vereda', 'vereda')
      .innerJoin('jornada_beneficiarios', 'jb', 'jb.beneficiario_id = b.id')
      .where('jb.jornada_id = :jornadaId', { jornadaId })
      .orderBy('b.apellidos', 'ASC')
      .addOrderBy('b.nombres', 'ASC')
      .getMany();
  }

  /**
   * Contexto de un envío. En un formulario por persona exige saber de quién es;
   * si la jornada tiene una sola persona, se toma esa.
   */
  async contextoEnvio(opciones: {
    jornadaId?: string | null;
    tipoPlantilla: TipoPlantilla;
    campos: CampoConAutocompletado[];
    beneficiarioId?: string | null;
    corregidasPorAdmin?: string[];
  }): Promise<ContextoAutocompletado & { beneficiarioId: string | null }> {
    const vacio = {
      beneficiario: null,
      beneficiariosJornada: [],
      corregidasPorAdmin: new Set(opciones.corregidasPorAdmin ?? []),
      beneficiarioId: null,
    };
    const usaAutocompletado =
      plantillaEsPorPersona(opciones.tipoPlantilla, opciones.campos) ||
      opciones.campos.some(tablaTieneAutocompletado);
    if (!opciones.jornadaId || (!usaAutocompletado && !opciones.beneficiarioId)) {
      return vacio;
    }

    const beneficiariosJornada = await this.beneficiariosDeJornada(
      opciones.jornadaId,
    );
    let beneficiario: Beneficiario | null = null;
    if (opciones.beneficiarioId) {
      beneficiario =
        beneficiariosJornada.find((b) => b.id === opciones.beneficiarioId) ?? null;
      if (!beneficiario) {
        throw new BadRequestException(
          'Esa persona no está en la jornada. Agrégala a la jornada antes de llenar su formulario.',
        );
      }
    } else if (
      plantillaEsPorPersona(opciones.tipoPlantilla, opciones.campos) &&
      beneficiariosJornada.length
    ) {
      if (beneficiariosJornada.length > 1) {
        throw new BadRequestException(
          'Este formulario se llena por persona: indica a qué beneficiario corresponde.',
        );
      }
      beneficiario = beneficiariosJornada[0];
    }

    return {
      beneficiario,
      beneficiariosJornada,
      corregidasPorAdmin: vacio.corregidasPorAdmin,
      beneficiarioId: beneficiario?.id ?? null,
    };
  }

  /**
   * Valores ya resueltos de todas las plantillas de la jornada, por persona.
   * La app los guarda con la jornada para precargar los formularios sin conexión.
   */
  async datosDeJornada(
    jornadaId: string,
    usuario: Usuario,
  ): Promise<AutocompletadoJornada> {
    const plantillas = await this.plantillasService.listarPorJornada(
      jornadaId,
      usuario,
    );
    const conAutocompletado = plantillas
      .map((plantilla) => ({
        plantilla,
        campos: (plantilla.campos ?? []) satisfies CampoConAutocompletado[],
      }))
      .filter(
        ({ plantilla, campos }) =>
          plantillaEsPorPersona(plantilla.tipoPlantilla, campos) ||
          campos.some(tablaTieneAutocompletado),
      );
    const personas = conAutocompletado.length
      ? await this.beneficiariosDeJornada(jornadaId)
      : [];

    const resultado: AutocompletadoJornada = {
      beneficiarios: personas.map((persona) => ({
        id: persona.id,
        nombre: `${persona.nombres} ${persona.apellidos}`.trim(),
        numeroDocumento: persona.numeroDocumento,
      })),
      plantillas: {},
    };
    if (!personas.length) return resultado;

    for (const { plantilla, campos } of conAutocompletado) {
      resultado.plantillas[plantilla.id] = {
        porPersona: plantillaEsPorPersona(plantilla.tipoPlantilla, campos),
        tablasFijas: campos.filter(tablaTieneAutocompletado).map((c) => c.clave),
        valores: Object.fromEntries(
          personas.map((persona) => [persona.id, valoresParaPersona(campos, persona)]),
        ),
      };
    }
    return resultado;
  }
}
