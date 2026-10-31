import type { DetailField, DetailValues } from '@gestion/shared';
import { FieldError } from '@/components/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { DETAIL_INPUT_PREFIX } from '@/lib/detail-fields';

/**
 * Sección Detalle de un formulario (HU-23b): los campos del tipo elegido. Cada uno va en un
 * input `detail:<id>` que lee readDetails al guardar. Ejemplo: una tarea Incidencia muestra
 * "Severidad *" (lista) y "Sistema afectado"; una Tarea no muestra la sección.
 */
export function DetailInputs({
  title,
  fields,
  values,
  errors,
  idPrefix,
  className = 'sm:col-span-2 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4',
}: {
  /** "Detalle de Incidencia" */
  title: string;
  /** Activos del tipo, en su orden */
  fields: DetailField[];
  values: DetailValues | undefined;
  errors: Record<string, string>;
  /** Para que los id no se repitan si hay dos formularios en la página */
  idPrefix: string;
  /** Cuántas columnas ocupa y tiene, según la cuadrícula del formulario */
  className?: string;
}) {
  if (fields.length === 0) return null;
  return (
    <fieldset className={`grid gap-4 rounded-md border p-3 ${className}`}>
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {fields.map((field) => {
        const id = `${idPrefix}-detail-${field.id}`;
        const error = errors[field.id];
        const common = {
          id,
          name: `${DETAIL_INPUT_PREFIX}${field.id}`,
          'aria-invalid': Boolean(error),
          'aria-describedby': error ? `${id}-error` : undefined,
        };
        const value = values?.[field.id];
        const text = value === undefined ? '' : String(value);
        const wide = field.kind === 'LONG_TEXT';
        return (
          <div key={field.id} className={wide ? 'col-span-full grid gap-2' : 'grid gap-2'}>
            <Label htmlFor={id}>
              {field.name}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            {field.kind === 'SHORT_TEXT' && (
              <Input {...common} defaultValue={text} maxLength={200} />
            )}
            {field.kind === 'LONG_TEXT' && (
              <Textarea {...common} defaultValue={text} rows={3} maxLength={5000} />
            )}
            {field.kind === 'NUMBER' && (
              <Input {...common} type="number" step="any" defaultValue={text} />
            )}
            {field.kind === 'DATE' && <Input {...common} type="date" defaultValue={text} />}
            {field.kind === 'OPTIONS' && (
              <NativeSelect {...common} defaultValue={text}>
                <option value="">—</option>
                {/* Un valor que ya no está en la lista (no debería pasar) se sigue mostrando */}
                {text !== '' && !field.options.includes(text) && (
                  <option value={text}>{text}</option>
                )}
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            )}
            {field.kind === 'BOOLEAN' && (
              <NativeSelect {...common} defaultValue={text}>
                <option value="">—</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </NativeSelect>
            )}
            <FieldError id={`${id}-error`} message={error} />
          </div>
        );
      })}
    </fieldset>
  );
}
