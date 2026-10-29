import {
  hasActiveFilters,
  type Project,
  type ProjectFilters,
  type ProjectType,
} from '@gestion/shared';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { PROJECT_PRIORITIES, PROJECT_SCOPES, PROJECT_STATUSES } from '@/lib/projects';

/** Valores distintos de un campo de texto, para ofrecerlos en su filtro (HU-09) */
function distinct(projects: Project[], pick: (project: Project) => string | null) {
  return [...new Set(projects.map(pick).filter((value): value is string => Boolean(value)))].sort(
    (a, b) => a.localeCompare(b, 'es'),
  );
}

/**
 * Filtros de la lista de contenedores (HU-09). Cada cambio va a la URL: un enlace compartido
 * abre la misma vista. Las opciones de área y clasificación salen de los valores existentes.
 */
export function ProjectFiltersBar({
  projects,
  types,
  filters,
  onChange,
}: {
  /** Todos los contenedores de la sección (sin filtrar), para armar las opciones */
  projects: Project[];
  /** Tipos de la sección: el filtro por tipo solo aparece si hay más de uno */
  types: ProjectType[];
  filters: ProjectFilters;
  onChange: (next: ProjectFilters) => void;
}) {
  const areas = distinct(projects, (p) => p.area);
  const classifications = distinct(projects, (p) => p.classification);

  /** Cambia un filtro; vacío lo quita de la URL */
  function set<K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K] | '') {
    onChange({ ...filters, [key]: value === '' || value === false ? undefined : value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={filters.showClosed ?? false}
          onChange={(event) => set('showClosed', event.target.checked)}
        />
        Mostrar terminados y cancelados
      </label>
      {hasActiveFilters(filters) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          // Se conserva el orden elegido; solo se quitan los filtros
          onClick={() => onChange({ sort: filters.sort, dir: filters.dir })}
        >
          <X aria-hidden />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
