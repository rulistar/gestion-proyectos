import { cn } from '@/lib/utils';

/** Barra de avance accesible (los lectores de pantalla leen el % y la etiqueta) */
export function ProgressBar({
  percent,
  label,
  className,
}: {
  percent: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      {/* Verde "Terminado" del prototipo */}
      <div className="h-full rounded-full bg-[#8FC9A0]" style={{ width: `${percent}%` }} />
    </div>
  );
}
