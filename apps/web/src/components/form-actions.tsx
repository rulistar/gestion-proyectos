import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface FormActionsProps {
  submitLabel: string;
  isPending: boolean;
  /** Error de la API, si la última petición falló */
  error?: string | undefined;
  /** Mensaje cuando no hay error, como "Cambios guardados" */
  status?: ReactNode;
  children?: ReactNode;
}

/** Botón de enviar + mensaje de error o de estado, al pie de un formulario */
export function FormActions({ submitLabel, isPending, error, status, children }: FormActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:col-span-full">
      <Button type="submit">{isPending ? 'Guardando…' : submitLabel}</Button>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        status
      )}
    </div>
  );
}
