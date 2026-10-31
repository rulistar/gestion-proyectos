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
