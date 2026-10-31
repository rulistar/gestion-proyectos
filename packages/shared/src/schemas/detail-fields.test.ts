import { describe, expect, it } from 'vitest';
import { createDetailFieldSchema, removedOptions } from './detail-fields.js';

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
