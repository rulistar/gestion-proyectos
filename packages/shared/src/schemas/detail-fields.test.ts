import { describe, expect, it } from 'vitest';
import {
  createDetailFieldSchema,
  detailErrorsMessage,
  mergeDetails,
  removedOptions,
  validateDetails,
  type DetailField,
} from './detail-fields.js';

const TYPE = '01a18cf0-0000-7000-8000-000000000000';

describe('campos de detalle (HU-23)', () => {
  it('una lista necesita opciones sin repetir; las demás clases no llevan', () => {
    const ok = createDetailFieldSchema.safeParse({
      taskTypeId: TYPE,
      name: ' Severidad ',
      kind: 'OPTIONS',
      options: [' Alta ', 'Baja'],
    });
    expect(ok.success && ok.data).toMatchObject({
      name: 'Severidad',
      required: false,
      options: ['Alta', 'Baja'],
    });
    expect(
      createDetailFieldSchema.safeParse({ taskTypeId: TYPE, name: 'S', kind: 'OPTIONS' }).success,
    ).toBe(false);
    expect(
      createDetailFieldSchema.safeParse({
        taskTypeId: TYPE,
        name: 'S',
        kind: 'OPTIONS',
        options: ['Alta', 'ALTA'],
      }).success,
    ).toBe(false);
    expect(
      createDetailFieldSchema.safeParse({
        taskTypeId: TYPE,
        name: 'S',
        kind: 'NUMBER',
        options: ['1'],
      }).success,
    ).toBe(false);
  });

  it('el campo es de un tipo de contenedor o de uno de tarea, no de los dos ni de ninguno', () => {
    const base = { name: 'Fecha de reporte', kind: 'DATE' };
    expect(createDetailFieldSchema.safeParse(base).success).toBe(false);
    expect(
      createDetailFieldSchema.safeParse({ ...base, taskTypeId: TYPE, projectTypeId: TYPE }).success,
    ).toBe(false);
    expect(createDetailFieldSchema.safeParse({ ...base, projectTypeId: TYPE }).success).toBe(true);
  });

  it('detecta las opciones que se quitarían (sin distinguir mayúsculas)', () => {
    expect(removedOptions(['Alta', 'Media', 'Baja'], ['alta', 'Baja', 'Mínima'])).toEqual([
      'Media',
    ]);
    expect(removedOptions(['Alta'], ['Alta', 'Baja'])).toEqual([]);
  });
});

describe('valores de los campos (HU-23b)', () => {
  const field = (id: string, kind: DetailField['kind'], extra: Partial<DetailField> = {}) => ({
    id,
    projectTypeId: null,
    taskTypeId: TYPE,
    name: id,
    kind,
    required: false,
    options: [],
    position: 0,
    archived: false,
    ...extra,
  });
  const FIELDS: DetailField[] = [
    field('severidad', 'OPTIONS', { required: true, options: ['Alta', 'Baja'] }),
    field('sistema', 'SHORT_TEXT'),
    field('horas', 'NUMBER'),
    field('reporte', 'DATE'),
    field('ventana', 'BOOLEAN'),
    field('viejo', 'SHORT_TEXT', { archived: true, required: true }),
  ];

  it('convierte cada clase y quita los vacíos', () => {
    expect(
      validateDetails(FIELDS, {
        severidad: 'Alta',
        sistema: '  ERP ',
        horas: '2.5',
        reporte: '2026-11-03',
        ventana: 'false',
      }),
    ).toEqual({
      values: {
        severidad: 'Alta',
        sistema: 'ERP',
        horas: 2.5,
        reporte: '2026-11-03',
        ventana: false,
      },
      errors: {},
    });
    expect(validateDetails(FIELDS, { severidad: 'Baja', sistema: '', horas: null }).values).toEqual(
      {
        severidad: 'Baja',
      },
    );
  });

  it('obligatorio vacío, opción inexistente, número o fecha inválidos dan error; los archivados no se piden', () => {
    const { errors } = validateDetails(FIELDS, {
      horas: 'dos',
      reporte: '3/11/2026',
      ventana: 'quizá',
    });
    expect(errors).toEqual({
      severidad: 'Obligatorio',
      horas: 'Escribe un número',
      reporte: 'Escribe una fecha válida',
      ventana: 'Elige Sí o No',
    });
    expect(validateDetails(FIELDS, { severidad: 'Media' }).errors).toEqual({
      severidad: 'Elige una opción de la lista',
    });
    expect(
      detailErrorsMessage(FIELDS, { severidad: 'Obligatorio', horas: 'Escribe un número' }),
    ).toBe('severidad: Obligatorio · horas: Escribe un número');
  });

  it('al guardar se reemplazan los del tipo y se conservan los archivados y los de otro tipo', () => {
    const previous = { severidad: 'Alta', sistema: 'ERP', viejo: 'x', deOtroTipo: 'y' };
    expect(mergeDetails(previous, FIELDS, { severidad: 'Baja' })).toEqual({
      severidad: 'Baja',
      viejo: 'x',
      deOtroTipo: 'y',
    });
  });
});
