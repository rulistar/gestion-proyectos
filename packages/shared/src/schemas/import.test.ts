import { describe, expect, it } from 'vitest';
import { CSV_BASE_COLUMNS, toCsv } from './export.js';
import { csvToImport, jsonToImport, normalizeDate, parseCsv, readImportFile } from './import.js';

describe('leer CSV (HU-14)', () => {
  it('comillas, comas, comillas dobles, saltos de línea, BOM y punto y coma', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","dice ""hola""\nadiós"\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'dice "hola"\nadiós'],
    ]);
    expect(parseCsv('a;b\n1;2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('lee lo que escribe Exportar', () => {
    const csv = toCsv([
      ['Proyecto', 'Tarea'],
      ['Lab, parte "A"', '=SUMA(1)'],
    ]);
    expect(parseCsv(csv)).toEqual([
      ['Proyecto', 'Tarea'],
      ['Lab, parte "A"', "'=SUMA(1)"],
    ]);
  });
});

describe('fechas (HU-14)', () => {
  it('AAAA-MM-DD, día/mes/año, años de 2 cifras y números de serie de Excel', () => {
    expect(normalizeDate('2026-11-03')).toBe('2026-11-03');
    expect(normalizeDate('3/11/2026')).toBe('2026-11-03');
    expect(normalizeDate('03-11-26')).toBe('2026-11-03');
    expect(normalizeDate('45962')).toBe('2025-11-01');
    expect(normalizeDate('31/02/2026')).toBeNull();
    expect(normalizeDate('mañana')).toBeNull();
    expect(normalizeDate('')).toBeNull();
  });
});

describe('CSV → modelo común (HU-14)', () => {
  const header = [...CSV_BASE_COLUMNS, 'Severidad', 'Sistema (contenedor)'];
  const row = (values: Record<string, string>) => header.map((column) => values[column] ?? '');

  it('agrupa las filas por folio, lee fases, estados en español y campos de detalle', () => {
    const csv = toCsv([
      header,
      row({
        Proyecto: 'Certificación Linux',
        Folio: 'PY2610-003',
        Estado: 'En curso',
        Prioridad: 'Alta',
        'Proyecto inicio': '01/11/2026',
        Fase: 'Módulo 101 / Tema 1',
        Tarea: 'Lab 1',
        Tipo: 'Tarea',
        'Duración (min)': '90',
        Completada: 'Sí',
        'Estado de la tarea': 'Hecha',
        Responsable: 'Rul',
        'Sistema (contenedor)': 'ERP',
      }),
      row({
        Proyecto: 'Certificación Linux',
        Folio: 'PY2610-003',
        Tarea: 'Falla',
        Tipo: 'Incidencia',
        Severidad: 'Alta',
      }),
      row({ Proyecto: 'Portal clientes', Sección: 'Mantenimientos' }),
    ]);
    const data = csvToImport(csv);
    expect(data.source).toBe('Excel (CSV)');
    expect(data.warnings).toEqual([]);
    expect(data.containers).toHaveLength(2);
    const [linux, portal] = data.containers;
    expect(linux).toMatchObject({
      name: 'Certificación Linux',
      folio: 'PY2610-003',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      startDate: '2026-11-01',
      details: { Sistema: 'ERP' },
    });
    expect(linux!.tasks.map((task) => [task.title, task.phasePath, task.status])).toEqual([
      ['Lab 1', ['Módulo 101', 'Tema 1'], 'DONE'],
      ['Falla', [], null],
    ]);
    expect(linux!.tasks[0]).toMatchObject({ estimatedMinutes: 90, responsibleName: 'Rul' });
    expect(linux!.tasks[1]!.details).toEqual({ Severidad: 'Alta' });
    expect(portal).toMatchObject({ name: 'Portal clientes', behavior: 'ONGOING', tasks: [] });
  });

  it('respaldo del prototipo: Curso, Unidad, Actividad y Completada', () => {
    const csv = [
      'Curso,Plataforma,Clasificación,Estado,Prioridad,Curso inicio,Curso fin,Unidad,Unidad inicio,Unidad fin,Actividad,Tipo,Duración (min),Actividad inicio,Actividad fin,Completada',
      'Inglés B2,Coursera,,En curso,Media,45962,,Unidad 1,,,Lectura 1,Lectura,30,,,Sí',
      'Inglés B2,Coursera,,En curso,Media,45962,,Unidad 1,,,Video 2,Video / lección,15,,,No',
    ].join('\n');
    const data = csvToImport(csv);
    expect(data.source).toBe('Respaldo del prototipo (CSV)');
    expect(data.containers[0]).toMatchObject({
      name: 'Inglés B2',
      area: 'Coursera',
      startDate: '2025-11-01',
    });
    expect(
      data.containers[0]!.tasks.map((task) => [task.title, task.phasePath, task.status]),
    ).toEqual([
      ['Lectura 1', ['Unidad 1'], 'DONE'],
      ['Video 2', ['Unidad 1'], 'PENDING'],
    ]);
  });

  it('avisa lo que no puede leer', () => {
    expect(csvToImport('Nombre,Otra\nx,y').warnings[0]).toContain('"Proyecto"');
    const data = csvToImport('Proyecto,Tarea,Tarea fin\n,Huérfana,\nPortal,Lab,ayer');
    expect(data.warnings).toEqual([
      'Fila 2: sin nombre de proyecto, se omite',
      'Fila 3: "ayer" no es una fecha válida (Tarea fin)',
    ]);
  });
});

describe('JSON → modelo común (HU-14)', () => {
  it('lee el respaldo de Exportar con fases anidadas y campos de detalle por nombre', () => {
    const json = JSON.stringify({
      format: 'gestor-de-proyectos',
      version: 1,
      catalogs: { detailFields: [{ id: 'f1', name: 'Severidad' }] },
      projects: [
        {
          name: 'Certificación Linux',
          folio: 'PY2610-003',
          type: { name: 'Proyecto', behavior: 'WITH_END' },
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          phases: [
            { id: 'p1', parentId: null, name: 'Módulo 101' },
            { id: 'p2', parentId: 'p1', name: 'Tema 1' },
          ],
          tasks: [
            {
              title: 'Falla',
              phaseId: 'p2',
              type: { name: 'Incidencia' },
              status: 'PENDING',
              responsible: { id: 'x', name: 'Rul' },
              details: { f1: 'Alta' },
            },
          ],
        },
      ],
    });
    const data = readImportFile(json);
    expect(data.source).toBe('JSON de Exportar');
    expect(data.containers[0]!.tasks[0]).toMatchObject({
      title: 'Falla',
      phasePath: ['Módulo 101', 'Tema 1'],
      typeName: 'Incidencia',
      responsibleName: 'Rul',
      details: { Severidad: 'Alta' },
    });
  });

  it('un JSON que no es de Exportar se rechaza con un aviso', () => {
    expect(jsonToImport('{"hola":1}').warnings[0]).toContain('no es un respaldo de Exportar');
    expect(jsonToImport('{roto').warnings[0]).toBe('El archivo no es un JSON válido');
  });
});
