import { z } from 'zod';

/** Clase de un campo de detalle (ADR-0004 §3); no cambia una vez creado */
export const detailFieldKindSchema = z.enum([
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DATE',
  'OPTIONS',
  'BOOLEAN',
]);
export type DetailFieldKind = z.infer<typeof detailFieldKindSchema>;

/** Campo de detalle de un tipo de contenedor o de un tipo de tarea (HU-23) */
export const detailFieldSchema = z.object({
  id: z.uuid(),
  /** Dueño: uno de los dos */
  projectTypeId: z.uuid().nullable(),
  taskTypeId: z.uuid().nullable(),
  name: z.string(),
  kind: detailFieldKindSchema,
  required: z.boolean(),
  /** Opciones de una lista */
  options: z.array(z.string()),
  position: z.number().int(),
  /** Archivado: ya no se muestra ni se pide; sus valores se conservan */
  archived: z.boolean(),
});
export type DetailField = z.infer<typeof detailFieldSchema>;

/** Respuesta de GET /workspaces/:workspaceId/detail-fields: todos los del espacio, en su orden */
export const detailFieldListSchema = z.array(detailFieldSchema);

const fieldName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(60, 'Máximo 60 caracteres');

const optionList = z
  .array(z.string().trim().min(1, 'Una opción está vacía').max(60, 'Máximo 60 caracteres'))
  .max(50, 'Máximo 50 opciones')
  .refine(
    (options) => new Set(options.map((option) => option.toLowerCase())).size === options.length,
    'Hay opciones repetidas',
  );

/**
 * Cuerpo de POST .../detail-fields: un campo nuevo de un tipo de contenedor o de tarea. Una lista
 * necesita al menos una opción; las demás clases no llevan opciones.
 */
export const createDetailFieldSchema = z
  .object({
    projectTypeId: z.uuid().optional(),
    taskTypeId: z.uuid().optional(),
    name: fieldName,
    kind: detailFieldKindSchema,
    required: z.boolean().default(false),
    options: optionList.default([]),
  })
  .refine((value) => (value.projectTypeId === undefined) !== (value.taskTypeId === undefined), {
    message: 'El campo es de un tipo de contenedor o de un tipo de tarea',
    path: ['projectTypeId'],
  })
  .refine((value) => value.kind !== 'OPTIONS' || value.options.length > 0, {
    message: 'Escribe al menos una opción',
    path: ['options'],
  })
  .refine((value) => value.kind === 'OPTIONS' || value.options.length === 0, {
    message: 'Solo las listas llevan opciones',
    path: ['options'],
  });
export type CreateDetailFieldInput = z.input<typeof createDetailFieldSchema>;
export type CreateDetailFieldData = z.infer<typeof createDetailFieldSchema>;

/**
 * Cuerpo de PATCH .../detail-fields/:fieldId: renombrar, obligatorio, agregar opciones o archivar.
 * La clase no cambia; las opciones solo se agregan (ADR-0004 §3).
 */
export const updateDetailFieldSchema = z
  .object({
    name: fieldName,
    required: z.boolean(),
    options: optionList,
    archived: z.boolean(),
  })
  .partial();
export type UpdateDetailFieldInput = z.infer<typeof updateDetailFieldSchema>;

/** Cuerpo de POST .../detail-fields/:fieldId/move: subir o bajar en el formulario */
export const moveDetailFieldSchema = z.object({ direction: z.enum(['up', 'down']) });
export type MoveDetailFieldInput = z.infer<typeof moveDetailFieldSchema>;

/** Opciones nuevas que quitan alguna de las anteriores (no se permite: dejaría valores inválidos) */
export function removedOptions(before: readonly string[], after: readonly string[]): string[] {
  const kept = new Set(after.map((option) => option.toLowerCase()));
  return before.filter((option) => !kept.has(option.toLowerCase()));
}

// --- Valores de los campos (HU-23b) ---

/** Un valor guardado: texto, número, fecha (AAAA-MM-DD), opción o Sí/No */
export const detailValueSchema = z.union([z.string(), z.number(), z.boolean()]);

/** Valores de un contenedor o una tarea, por ID de campo (columna `details`) */
export const detailValuesSchema = z.record(z.string(), detailValueSchema);
export type DetailValues = z.infer<typeof detailValuesSchema>;

/** Lo que llega en el cuerpo: también null o "" para vaciar un campo */
export const detailValuesInputSchema = z
  .record(z.uuid(), detailValueSchema.nullable())
  .refine((values) => Object.keys(values).length <= 100, 'Demasiados campos');

const TEXT_MAX: Partial<Record<DetailFieldKind, number>> = { SHORT_TEXT: 200, LONG_TEXT: 5000 };

function isEmpty(raw: unknown): boolean {
  return raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
}

/** Convierte un valor a la clase del campo; un texto como mensaje si no es válido */
function coerce(field: DetailField, raw: unknown): { value: string | number | boolean } | string {
  switch (field.kind) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT': {
      if (typeof raw !== 'string') return 'Escribe un texto';
      const max = TEXT_MAX[field.kind]!;
      return raw.trim().length > max ? `Máximo ${max} caracteres` : { value: raw.trim() };
    }
    case 'NUMBER': {
      const value = typeof raw === 'string' ? Number(raw.trim()) : raw;
      return typeof value === 'number' && Number.isFinite(value) ? { value } : 'Escribe un número';
    }
    case 'DATE':
      return typeof raw === 'string' && z.iso.date().safeParse(raw).success
        ? { value: raw }
        : 'Escribe una fecha válida';
    case 'OPTIONS':
      return typeof raw === 'string' && field.options.includes(raw)
        ? { value: raw }
        : 'Elige una opción de la lista';
    case 'BOOLEAN':
      if (raw === true || raw === 'true') return { value: true };
      if (raw === false || raw === 'false') return { value: false };
      return 'Elige Sí o No';
  }
}

/**
 * Valida los valores contra los campos activos del tipo (HU-23b, ADR-0004 §3). Lo usan la API (la
 * que decide) y la web (para marcar cada campo). Un obligatorio vacío, un número que no lo es o una
 * opción que no existe dan error en ese campo. Ej.: Incidencia sin Severidad → "Obligatorio".
 */
export function validateDetails(
  fields: readonly DetailField[],
  input: Readonly<Record<string, unknown>>,
): { values: DetailValues; errors: Record<string, string> } {
  const values: DetailValues = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.archived) continue;
    const raw = input[field.id];
    if (isEmpty(raw)) {
      if (field.required) errors[field.id] = 'Obligatorio';
      continue;
    }
    const result = coerce(field, raw);
    if (typeof result === 'string') errors[field.id] = result;
    else values[field.id] = result.value;
  }
  return { values, errors };
}

/**
 * Valores a guardar: los de los campos del tipo se reemplazan por los validados (los vacíos se
 * quitan); los demás (archivados o de otro tipo, si se cambió) se conservan.
 */
export function mergeDetails(
  previous: Readonly<DetailValues>,
  fields: readonly DetailField[],
  validated: Readonly<DetailValues>,
): DetailValues {
  const active = new Set(fields.filter((field) => !field.archived).map((field) => field.id));
  const kept = Object.entries(previous).filter(([id]) => !active.has(id));
  return { ...Object.fromEntries(kept), ...validated };
}

/** "Severidad: Obligatorio · Horas: Escribe un número" para la respuesta 400 de la API */
export function detailErrorsMessage(
  fields: readonly DetailField[],
  errors: Readonly<Record<string, string>>,
): string {
  return fields
    .filter((field) => errors[field.id])
    .map((field) => `${field.name}: ${errors[field.id]}`)
    .join(' · ');
}
