import { z } from 'zod';

export const projectStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'PAUSED',
  'CANCELLED',
  'DONE',
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectPrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type ProjectPriority = z.infer<typeof projectPrioritySchema>;

/** Texto opcional: se recorta y, si queda vacío, se guarda como null */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .nullish()
    .transform((value) => value || null);
}

/**
 * Fecha sin hora en formato AAAA-MM-DD (lo que envía un <input type="date">).
 * Un campo vacío ("") cuenta como "sin fecha".
 */
const optionalDate = z
  .preprocess(
    (value) => (value === '' ? null : value),
    z.iso.date('Fecha no válida (AAAA-MM-DD)').nullish(),
  )
  .transform((value) => value ?? null);

/** Cuerpo de POST y PUT /workspaces/:workspaceId/projects (HU-05) */
export const projectInputSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres'),
    area: optionalText(80),
    classification: optionalText(80),
    status: projectStatusSchema.default('NOT_STARTED'),
    priority: projectPrioritySchema.default('MEDIUM'),
    startDate: optionalDate,
    endDate: optionalDate,
    notes: optionalText(2000),
  })
  // Las fechas AAAA-MM-DD se pueden comparar como texto
  .refine((p) => !p.startDate || !p.endDate || p.endDate >= p.startDate, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['endDate'],
  });
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const projectSchema = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  name: z.string(),
  area: z.string().nullable(),
  classification: z.string().nullable(),
  status: projectStatusSchema,
  priority: projectPrioritySchema,
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  notes: z.string().nullable(),
});
export type Project = z.infer<typeof projectSchema>;

/** Respuesta de GET /workspaces/:workspaceId/projects */
export const projectListSchema = z.array(projectSchema);
