import { BadRequestException } from '@nestjs/common';
import { EstadoFuncional } from './estado-funcional.enum';
import {
  puedeTransicionar,
  transicionarEstado,
} from './maquina-estados';

describe('máquina de estados RF-19', () => {
  it('permite SINCRONIZADO → EN_REVISION', () => {
    expect(
      puedeTransicionar(
        EstadoFuncional.SINCRONIZADO,
        EstadoFuncional.EN_REVISION,
      ),
    ).toBe(true);
  });

  it('bloquea BORRADOR → APROBADO', () => {
    expect(() =>
      transicionarEstado(EstadoFuncional.BORRADOR, EstadoFuncional.APROBADO),
    ).toThrow(BadRequestException);
  });

  it('atajo online BORRADOR → EN_REVISION', () => {
    expect(
      transicionarEstado(
        EstadoFuncional.BORRADOR,
        EstadoFuncional.EN_REVISION,
        { permitirAtajosOnline: true },
      ),
    ).toBe(EstadoFuncional.EN_REVISION);
  });

  it('rechazo → corrección → revisión', () => {
    const a = transicionarEstado(
      EstadoFuncional.EN_REVISION,
      EstadoFuncional.RECHAZADO,
    );
    const b = transicionarEstado(a, EstadoFuncional.EN_CORRECCION);
    const c = transicionarEstado(b, EstadoFuncional.EN_REVISION);
    expect(c).toBe(EstadoFuncional.EN_REVISION);
  });
});
