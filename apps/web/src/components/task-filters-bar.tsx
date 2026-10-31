import {
  hasActiveFilters,
  NO_ORIGIN,
  NO_RESPONSIBLE,
  type Person,
  type Project,
  type ProjectBehavior,
  type TaskFilters,
  type TaskOrigin,
  type TaskType,
} from '@gestion/shared';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { SECTIONS } from '@/lib/project-types';
import { TASK_STATUSES } from '@/lib/tasks';

/**
 * Filtros de la vista "Tareas" (HU-39), con el mismo estilo que los de proyectos (HU-09). Cada
 * cambio va a la URL. El contenedor se elige de la sección filtrada, si hay una. En la pestaña
 * Lista de un proyecto (HU-26) no hay sección ni contenedor: ya es ese proyecto.
 */
export function TaskFiltersBar({
  projects,
  taskTypes,
  people,
  origins,
  filters,
  onChange,
  inProject = false,
}: {
  projects: Project[];
  taskTypes: TaskType[];
  people: Person[];
  /** Catálogo de orígenes (HU-47) */
  origins: TaskOrigin[];
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  /** Pestaña Lista de un proyecto: sin sección ni contenedor */
  inProject?: boolean;
}) {
  const containers = projects
    .filter((project) => !filters.behavior || project.type.behavior === filters.behavior)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  /** Cambia un filtro; vacío (o casilla apagada) lo quita de la URL */
  function set<K extends keyof TaskFilters>(key: K, value: TaskFilters[K] | '') {
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
          aria-label={
            inProject
              ? 'Buscar por título, responsable u origen'
              : 'Buscar por título, responsable, proyecto u origen'
          }
          placeholder={
            inProject
              ? 'Buscar por título, responsable u origen…'
              : 'Buscar por título, responsable, folio, proyecto u origen…'
          }
          className="pl-8"
          value={filters.q ?? ''}
          onChange={(event) => set('q', event.target.value)}
        />
      </div>
      {!inProject && (
        <>
          <NativeSelect
            aria-label="Sección"
            className="h-9 w-44"
            value={filters.behavior ?? ''}
            // Al cambiar de sección, el contenedor elegido puede dejar de pertenecer a ella
            onChange={(event) =>
              onChange({
                ...filters,
                behavior: (event.target.value || undefined) as ProjectBehavior | undefined,
                projectId: undefined,
              })
            }
          >
            <option value="">Todas las secciones</option>
            {(Object.keys(SECTIONS) as ProjectBehavior[]).map((behavior) => (
              <option key={behavior} value={behavior}>
                {SECTIONS[behavior].title}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Proyecto, mantenimiento o actividad"
            className="h-9 w-56"
            value={filters.projectId ?? ''}
            onChange={(event) => set('projectId', event.target.value)}
          >
            <option value="">Todo proyecto, mantenimiento o actividad</option>
            {containers.map((project) => (
              <option key={project.id} value={project.id}>
                {project.folio ? `${project.folio} · ` : ''}
                {project.name}
              </option>
            ))}
          </NativeSelect>
        </>
      )}
      <NativeSelect
        aria-label="Tipo de tarea"
        className="h-9 w-40"
        value={filters.typeId ?? ''}
        onChange={(event) => set('typeId', event.target.value)}
      >
        <option value="">Todos los tipos</option>
        {taskTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.expedited ? `⚡ ${type.name}` : type.name}
            {type.archived ? ' (archivado)' : ''}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Responsable"
        className="h-9 w-44"
        value={filters.responsibleId ?? ''}
        onChange={(event) => set('responsibleId', event.target.value)}
      >
        <option value="">Todo responsable</option>
        <option value={NO_RESPONSIBLE}>Sin asignar</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
            {person.archived ? ' (archivada)' : ''}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Origen"
        className="h-9 w-40"
        value={filters.originId ?? ''}
        onChange={(event) => set('originId', event.target.value)}
      >
        <option value="">Todo origen</option>
        <option value={NO_ORIGIN}>Sin origen</option>
        {origins.map((origin) => (
          <option key={origin.id} value={origin.id}>
            {origin.name}
            {origin.archived ? ' (archivado)' : ''}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Estado"
        className="h-9 w-36"
        value={filters.status ?? ''}
        onChange={(event) => set('status', event.target.value as TaskFilters['status'] & string)}
      >
        <option value="">Todo estado</option>
        {Object.entries(TASK_STATUSES).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Fin hasta
        <Input
          type="date"
          aria-label="Fecha de fin de la tarea hasta"
          className="h-9 w-40"
          value={filters.endBy ?? ''}
          onChange={(event) => set('endBy', event.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={filters.overdue ?? false}
          onChange={(event) => set('overdue', event.target.checked)}
        />
        Solo vencidas
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={filters.showClosed ?? false}
          onChange={(event) => set('showClosed', event.target.checked)}
        />
        Mostrar hechas y canceladas
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
