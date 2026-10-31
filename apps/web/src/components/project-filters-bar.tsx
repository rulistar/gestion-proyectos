import type { ReactNode } from 'react';
import {
  hasActiveFilters,
  type Project,
  type ProjectFilters,
  type ProjectType,
  projectYears,
} from '@gestion/shared';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { PROJECT_PRIORITIES, PROJECT_SCOPES, PROJECT_STATUSES } from '@/lib/projects';

/** Valores distintos de un campo de texto, para ofrecerlos en su filtro (HU-09) */
function distinct(projects: Project[], pick: (project: Project) => string | null) {
  return [...new Set(projects.map(pick).filter((value): value is string => Boolean(value)))].sort(
    (a, b) => a.localeCompare(b, 'es'),
  );
}

const STATES = [
  ['open', 'Abiertos'],
  ['closed', 'Cerrados'],
  ['all', 'Ambos'],
] as const;

/**
 * Filtros de la lista de contenedores (HU-09). Cada cambio va a la URL: un enlace compartido
 * abre la misma vista. Las opciones de área y clasificación salen de los valores existentes.
 */
export function ProjectFiltersBar({
  projects,
  types,
  filters,
  onChange,
  leading,
  currentYear,
  hideState = false,
}: {
  /** Año en curso del usuario: el de omisión del filtro por año (HU-55) */
  currentYear: number;
  /** Sin el selector Abiertos / Cerrados / Ambos (en el tablero) */
  hideState?: boolean;
  /** Al inicio del renglón, antes del buscador: el selector Tabla · Tablero (HU-10) */
  leading?: ReactNode;
  /** Todos los contenedores de la sección (sin filtrar), para armar las opciones */
  projects: Project[];
  /** Tipos de la sección: el filtro por tipo solo aparece si hay más de uno */
  types: ProjectType[];
  filters: ProjectFilters;
  onChange: (next: ProjectFilters) => void;
}) {
  const years = projectYears(projects, currentYear);
  const areas = distinct(projects, (p) => p.area);
  const classifications = distinct(projects, (p) => p.classification);

  /** Cambia un filtro; vacío lo quita de la URL */
  function set<K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K] | '') {
    onChange({ ...filters, [key]: value === '' ? undefined : value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}
      <div className="relative min-w-56 flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Buscar por nombre, folio, sprint o personas"
          placeholder="Buscar por nombre, folio, sprint o personas…"
          className="pl-8"
          value={filters.q ?? ''}
          onChange={(event) => set('q', event.target.value)}
        />
      </div>
      {types.length > 1 && (
        <NativeSelect
          aria-label="Tipo"
          className="h-9 w-44"
          value={filters.typeId ?? ''}
          onChange={(event) => set('typeId', event.target.value)}
        >
          <option value="">Todos los tipos</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <NativeSelect
        aria-label="Ámbito"
        className="h-9 w-40"
        value={filters.scope ?? ''}
        onChange={(event) => set('scope', event.target.value as ProjectFilters['scope'] & string)}
      >
        <option value="">Trabajo y personal</option>
        {Object.entries(PROJECT_SCOPES).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Estado"
        className="h-9 w-40"
        value={filters.status ?? ''}
        onChange={(event) => set('status', event.target.value as ProjectFilters['status'] & string)}
      >
        <option value="">Todos los estados</option>
        {Object.entries(PROJECT_STATUSES).map(([value, { label }]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Prioridad"
        className="h-9 w-40"
        value={filters.priority ?? ''}
        onChange={(event) =>
          set('priority', event.target.value as ProjectFilters['priority'] & string)
        }
      >
        <option value="">Toda prioridad</option>
        {Object.entries(PROJECT_PRIORITIES).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      {areas.length > 0 && (
        <NativeSelect
          aria-label="Área"
          className="h-9 w-40"
          value={filters.area ?? ''}
          onChange={(event) => set('area', event.target.value)}
        >
          <option value="">Toda área</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </NativeSelect>
      )}
      {classifications.length > 0 && (
        <NativeSelect
          aria-label="Clasificación"
          className="h-9 w-44"
          value={filters.classification ?? ''}
          onChange={(event) => set('classification', event.target.value)}
        >
          <option value="">Toda clasificación</option>
          {classifications.map((classification) => (
            <option key={classification} value={classification}>
              {classification}
            </option>
          ))}
        </NativeSelect>
      )}
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Fin hasta
        <Input
          type="date"
          aria-label="Fecha de fin hasta"
          className="h-9 w-40"
          value={filters.endBy ?? ''}
          onChange={(event) => set('endBy', event.target.value)}
        />
      </label>
      {/* Año (HU-55): los años con datos, el en curso por omisión */}
      <NativeSelect
        aria-label="Año"
        className="h-9 w-24"
        value={String(filters.year ?? currentYear)}
        onChange={(event) => {
          const year = Number(event.target.value);
          set('year', year === currentYear ? '' : year);
        }}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </NativeSelect>
      {/* En el tablero, los cerrados se muestran con sus botones (HU-10) */}
      {!hideState && (
        <div
          role="group"
          aria-label="Abiertos o cerrados"
          className="inline-flex rounded-md border p-0.5"
        >
          {STATES.map(([state, label]) => (
            <button
              key={state}
              type="button"
              aria-pressed={(filters.state ?? 'open') === state}
              onClick={() => set('state', state === 'open' ? '' : state)}
              className={cn(
                'rounded px-2.5 py-1 text-sm',
                (filters.state ?? 'open') === state
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {hasActiveFilters(filters) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          // Se conserva el orden elegido; solo se quitan los filtros
          onClick={() => onChange({ sort: filters.sort, dir: filters.dir, view: filters.view })}
        >
          <X aria-hidden />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
