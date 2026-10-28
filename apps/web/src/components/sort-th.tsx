import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Encabezado de tabla que ordena por su columna (HU-09, HU-39); muestra la flecha del orden
 * actual. Lo usan las listas de proyectos y de tareas.
 */
export function SortTh<K extends string>({
  column,
  sort,
  dir,
  onSort,
  children,
}: {
  column: K;
  sort: K | undefined;
  dir: 'asc' | 'desc';
  onSort: (column: K) => void;
  children: ReactNode;
}) {
  const active = sort === column;
  return (
    <th
      className="py-1.5 pr-4 font-medium"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground' : ''}`}
      >
        {children}
        {active &&
          (dir === 'asc' ? (
            <ArrowUp aria-hidden className="size-3" />
          ) : (
            <ArrowDown aria-hidden className="size-3" />
          ))}
      </button>
    </th>
  );
}
