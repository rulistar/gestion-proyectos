import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Basado en el NativeSelect de shadcn/ui: un <select> del navegador con el estilo de Input
// (accesible y sin dependencias; el Select de shadcn necesitaría otro paquete de Radix)
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}
