import { z } from 'zod';
import { emailSchema } from './auth.js';
import { workspaceSummarySchema } from './workspaces.js';

export const userStatusSchema = z.enum(['ACTIVE', 'DISABLED']);
export type UserStatus = z.infer<typeof userStatusSchema>;

/** Una cuenta, vista por el Admin del sistema (HU-30) */
export const systemUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  status: userStatusSchema,
  isSystemAdmin: z.boolean(),
  lastLoginAt: z.iso.datetime().nullable(),
  /** Espacios donde es miembro, con su rol */
  workspaces: z.array(workspaceSummarySchema),
});
export type SystemUser = z.infer<typeof systemUserSchema>;

/** Respuesta de GET /users; por nombre */
export const systemUserListSchema = z.array(systemUserSchema);

/** Cuerpo de PUT /users/:userId/email: corregir el correo de alguien (mismas reglas que HU-29) */
export const changeUserEmailSchema = z.object({ email: emailSchema });
export type ChangeUserEmailInput = z.infer<typeof changeUserEmailSchema>;

/** Cuerpo de PATCH /users/:userId/status: desactivar o reactivar una cuenta */
export const setUserStatusSchema = z.object({ status: userStatusSchema });
export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;
