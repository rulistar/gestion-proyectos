import { z } from 'zod';

/** Texto opcional: se recorta y, si queda vacío, se guarda como null */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .nullish()
    .transform((value) => value || null);
}

/** Un campo de formulario vacío ("") cuenta como "sin valor" */
const emptyToNull = (value: unknown) => (value === '' ? null : value);

/** Fecha sin hora en formato AAAA-MM-DD (lo que envía un <input type="date">) */
export const optionalDate = z
  .preprocess(emptyToNull, z.iso.date('Fecha no válida (AAAA-MM-DD)').nullish())
  .transform((value) => value ?? null);

/** Número entero opcional; acepta el texto de un <input type="number"> */
export function optionalInt(max: number) {
  return z
    .preprocess(
      emptyToNull,
      z.coerce
        .number('Debe ser un número')
        .int('Debe ser un número entero')
        .min(0, 'No puede ser negativo')
        .max(max, `Máximo ${max}`)
        .nullish(),
    )
    .transform((value) => value ?? null);
}

/** ID opcional (por ejemplo, "Sin asignar" en un selector) */
export const optionalId = z
  .preprocess(emptyToNull, z.uuid('Valor no válido').nullish())
  .transform((value) => value ?? null);

/** Fin igual o posterior al inicio (las fechas AAAA-MM-DD se pueden comparar como texto) */
export function endAfterStart(value: { startDate: string | null; endDate: string | null }) {
  return !value.startDate || !value.endDate || value.endDate >= value.startDate;
}

export const endAfterStartError = {
  message: 'La fecha de fin no puede ser anterior a la de inicio',
  path: ['endDate'],
};
