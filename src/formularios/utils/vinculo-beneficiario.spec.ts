import { BadRequestException } from '@nestjs/common';
import { Genero } from '../../beneficiarios/enums/genero.enum';
import { FaseFormulario } from '../enums/fase-formulario.enum';
import { TipoCampo } from '../enums/tipo-campo.enum';
import {
  normalizarVinculos,
  validarVinculosPlantilla,
  valorParaDestino,
} from './vinculo-beneficiario';

const adicionales = new Map([
  ['area_finca', 'numero' as const],
  ['cultivo', 'texto' as const],
]);

describe('validarVinculosPlantilla', () => {
  it('rechaza vínculos en formularios de ejecución', () => {
    expect(() =>
      validarVinculosPlantilla(
        FaseFormulario.EJECUCION,
        [
          {
            clave: 'tel',
            etiqueta: 'Teléfono',
            tipoCampo: TipoCampo.TEXTO,
            vincularBeneficiario: { destino: 'beneficiario.telefono' },
          },
        ],
        adicionales,
      ),
    ).toThrow(BadRequestException);
  });

  it('rechaza destinos de identidad, tipos incompatibles y destinos repetidos', () => {
    const base = { etiqueta: 'P', tipoCampo: TipoCampo.TEXTO };
    expect(() =>
      validarVinculosPlantilla(
        FaseFormulario.LINEA_BASE,
        [
          {
            ...base,
            clave: 'a',
            vincularBeneficiario: { destino: 'beneficiario.numeroDocumento' },
          },
        ],
        adicionales,
      ),
    ).toThrow(/no existe o no se puede modificar/);
    expect(() =>
      validarVinculosPlantilla(
        FaseFormulario.LINEA_BASE,
        [
          {
            ...base,
            clave: 'a',
            tipoCampo: TipoCampo.FOTO,
            vincularBeneficiario: { destino: 'beneficiario.telefono' },
          },
        ],
        adicionales,
      ),
    ).toThrow(/tipo de la pregunta/);
    expect(() =>
      validarVinculosPlantilla(
        FaseFormulario.LINEA_BASE,
        [
          {
            ...base,
            clave: 'a',
            vincularBeneficiario: { destino: 'beneficiario.telefono' },
          },
          {
            ...base,
            clave: 'b',
            vincularBeneficiario: { destino: 'beneficiario.telefono' },
          },
        ],
        adicionales,
      ),
    ).toThrow(/mismo dato/);
  });

  it('acepta datos de ficha, adicionales y vereda PDET', () => {
    expect(() =>
      validarVinculosPlantilla(
        FaseFormulario.LINEA_BASE,
        [
          {
            clave: 'a',
            etiqueta: 'Tel',
            tipoCampo: TipoCampo.TEXTO,
            vincularBeneficiario: { destino: 'beneficiario.telefono' },
          },
          {
            clave: 'b',
            etiqueta: 'Área',
            tipoCampo: TipoCampo.NUMERO,
            vincularBeneficiario: { destino: 'beneficiario.extra.area_finca' },
          },
          {
            clave: 'c',
            etiqueta: 'PDET',
            tipoCampo: TipoCampo.VEREDA_PDET,
            vincularBeneficiario: { destino: 'beneficiario.veredaPdet' },
          },
        ],
        adicionales,
      ),
    ).not.toThrow();
  });
});

describe('normalizarVinculos', () => {
  it('prellena editable por defecto cuando el tipo lo permite', () => {
    const [tel, area, pdet, multiple] = normalizarVinculos(
      [
        {
          clave: 'a',
          etiqueta: 'Tel',
          tipoCampo: TipoCampo.TEXTO,
          vincularBeneficiario: { destino: 'beneficiario.telefono' },
        },
        {
          clave: 'b',
          etiqueta: 'Área',
          tipoCampo: TipoCampo.NUMERO,
          vincularBeneficiario: { destino: 'beneficiario.extra.area_finca' },
        },
        {
          clave: 'c',
          etiqueta: 'PDET',
          tipoCampo: TipoCampo.VEREDA_PDET,
          vincularBeneficiario: { destino: 'beneficiario.veredaPdet' },
        },
        {
          clave: 'd',
          etiqueta: 'Cultivos',
          tipoCampo: TipoCampo.SELECCION_MULTIPLE,
          vincularBeneficiario: { destino: 'beneficiario.extra.cultivo' },
        },
      ],
      adicionales,
    );
    expect(tel.autocompletar).toEqual({
      origen: 'beneficiario.telefono',
      editable: true,
    });
    expect(area.autocompletar).toEqual({
      origen: 'beneficiario.extra.area_finca',
      editable: true,
    });
    expect(pdet.autocompletar).toBeUndefined();
    expect(multiple.autocompletar).toBeUndefined();
  });

  it('prellena fijo si no se permite el cambio', () => {
    const [tel] = normalizarVinculos(
      [
        {
          clave: 'a',
          etiqueta: 'Tel',
          tipoCampo: TipoCampo.TEXTO,
          vincularBeneficiario: {
            destino: 'beneficiario.telefono',
            permitirCambio: false,
          },
        },
      ],
      adicionales,
    );
    expect(tel.autocompletar).toEqual({ origen: 'beneficiario.telefono' });
    expect(tel.vincularBeneficiario).toEqual({
      destino: 'beneficiario.telefono',
      permitirCambio: false,
    });
  });
});

describe('valorParaDestino', () => {
  it('convierte texto, número, fecha, sí/no y múltiple', () => {
    expect(
      valorParaDestino('beneficiario.telefono', 'texto', TipoCampo.TEXTO, {
        valorTexto: ' 3001234567 ',
      }),
    ).toEqual({ tipo: 'escalar', valor: '3001234567' });
    expect(
      valorParaDestino(
        'beneficiario.extra.area_finca',
        'numero',
        TipoCampo.NUMERO,
        { valorNumero: '2.50' },
      ),
    ).toEqual({ tipo: 'escalar', valor: 2.5 });
    expect(
      valorParaDestino(
        'beneficiario.fechaNacimiento',
        'fecha',
        TipoCampo.FECHA,
        {
          valorFecha: new Date('1980-05-04T00:00:00Z'),
        },
      ),
    ).toEqual({ tipo: 'escalar', valor: '1980-05-04' });
    expect(
      valorParaDestino(
        'beneficiario.extra.cultivo',
        'texto',
        TipoCampo.SELECCION_MULTIPLE,
        {
          valorJson: ['Cacao', 'Ñame'] as unknown as Record<string, unknown>,
        },
      ),
    ).toEqual({ tipo: 'escalar', valor: 'Cacao; Ñame' });
  });

  it('normaliza sexo y descarta valores que no encajan', () => {
    expect(
      valorParaDestino(
        'beneficiario.genero',
        'texto',
        TipoCampo.SELECCION_UNICA,
        { valorTexto: 'Mujer' },
      ),
    ).toEqual({ tipo: 'escalar', valor: Genero.FEMENINO });
    expect(
      valorParaDestino(
        'beneficiario.genero',
        'texto',
        TipoCampo.SELECCION_UNICA,
        { valorTexto: 'N/A' },
      ),
    ).toBeUndefined();
    expect(
      valorParaDestino('beneficiario.edad', 'numero', TipoCampo.NUMERO, {
        valorNumero: 300,
      }),
    ).toBeUndefined();
    expect(
      valorParaDestino('beneficiario.telefono', 'texto', TipoCampo.TEXTO, {
        valorTexto: '   ',
      }),
    ).toBeUndefined();
  });

  it('lee la vereda PDET del valor JSON', () => {
    expect(
      valorParaDestino(
        'beneficiario.veredaPdet',
        'vereda_pdet',
        TipoCampo.VEREDA_PDET,
        {
          valorJson: { veredaPdetId: 'abc' },
        },
      ),
    ).toEqual({ tipo: 'vereda_pdet', veredaPdetId: 'abc' });
  });
});
