import { describe, expect, it } from 'vitest';
import type { DetailField } from './detail-fields.js';
import { CSV_BASE_COLUMNS, detailCell, detailColumns, toCsv } from './export.js';

const field = (
  name: string,
  owner: 'task' | 'container',
  kind: DetailField['kind'] = 'SHORT_TEXT',
) =>
  ({
    id: `${owner}-${name}`,
    projectTypeId: owner === 'container' ? 'pt' : null,
    taskTypeId: owner === 'task' ? 'tt' : null,
    name,
    kind,
    required: false,
    options: [],
    position: 0,
    archived: false,
  }) satisfies DetailField;

describe('exportar (HU-13)', () => {
  it('las 16 columnas del prototipo van primero, en su orden, con los nombres de ahora', () => {
    expect(CSV_BASE_COLUMNS.slice(0, 16)).toEqual([
      'Proyecto',
      'Área',
      'Clasificación',
      'Estado',
      'Prioridad',
      'Proyecto inicio',
      'Proyecto fin',
      'Fase',
      'Fase inicio',
      'Fase fin',
      'Tarea',
      'Tipo',
      'Duración (min)',
      'Tarea inicio',
      'Tarea fin',
      'Completada',
    ]);
  });

  it('CSV con BOM, CRLF, comillas cuando hace falta y sin fórmulas de Excel', () => {
    expect(
      toCsv([
        ['Tarea', 'Notas'],
        ['Lab, parte 1', 'dice "hola"\nadiós'],
        ['=SUMA(A1)', '-5'],
      ]),
    ).toBe('\uFEFFTarea,Notas\r\n"Lab, parte 1","dice ""hola""\nadiós"\r\n\'=SUMA(A1),-5\r\n');
  });

  it('una columna por nombre de campo; el del contenedor que choca con uno de tarea se distingue', () => {
    const fields = [
      field('Severidad', 'task'),
      field('Severidad', 'task'),
      field('Sistema', 'task'),
      field('Sistema', 'container'),
      field('Patrocinador', 'container'),
    ];
    const columns = detailColumns(fields);
    expect(columns.task).toEqual(['Severidad', 'Sistema']);
    expect(columns.container).toEqual(['Sistema (contenedor)', 'Patrocinador']);
    expect(detailCell({ kind: 'BOOLEAN' }, false)).toBe('No');
    expect(detailCell({ kind: 'NUMBER' }, 2.5)).toBe('2.5');
    expect(detailCell({ kind: 'DATE' }, undefined)).toBe('');
  });
});
