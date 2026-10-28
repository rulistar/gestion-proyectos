import type { ReactNode } from 'react';

/**
 * Encabezado compacto de página (HU-41): el título y su descripción en la misma línea, y a la
 * derecha el conteo o los botones. Ahorra espacio vertical para que se vea más información.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Lo que va a la derecha: conteo, botones */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}
