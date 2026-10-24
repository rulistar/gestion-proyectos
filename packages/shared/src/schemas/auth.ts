import { z } from 'zod';

/** Correo normalizado: sin espacios y en minúsculas, para que no haya dos cuentas "iguales" */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Correo no válido'));

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(100, 'Máximo 100 caracteres');

/**
 * Política mínima de contraseñas (OWASP): longitud antes que complejidad.
 * El máximo evita que una contraseña enorme haga trabajar de más al hash.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(256, 'Máximo 256 caracteres');
