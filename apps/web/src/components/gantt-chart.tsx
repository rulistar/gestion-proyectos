import {
  daysBetween,
  GANTT_DAY_WIDTH,
  ganttBox,
  ganttTicks,
  type DayRange,
  type GanttBars,
  type GanttZoom,
  type TaskStatus,
} from '@gestion/shared';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDate } from '@/lib/dates';
import { TASK_STATUSES } from '@/lib/tasks';
import { cn } from '@/lib/utils';

/** Ancho de la columna de nombres, en píxeles */
const LABEL_WIDTH = 288;

/** Color de la barra planeada según el estado de la tarea */
const PLANNED_CLASS: Record<TaskStatus, string> = {
  PENDING: 'bg-primary/25',
  IN_PROGRESS: 'bg-primary/45',
  PAUSED: 'bg-warning/70',
  DONE: 'bg-emerald-500/40',
  CANCELLED: 'bg-muted-foreground/25',
};

/** Un renglón del Gantt: una tarea, o un grupo (contenedor, fase o "Sin fase") */
export interface GanttRow {
  key: string;
  label: ReactNode;
  /** Nivel de sangría; 0 = sin sangría */
  depth: number;
  /** Grupo plegable: se dibuja como barra resumen */
  group?: { open: boolean; onToggle: () => void; count: number };
  bars: GanttBars;
  /** Estado de la tarea (colorea la barra planeada); los grupos no lo tienen */
  status?: TaskStatus;
  /** Clic en el nombre (editar la tarea, abrir el contenedor) */
  onOpen?: (() => void) | undefined;
}

function spanText(span: DayRange): string {
  return span.start === span.end
    ? formatDate(span.start)
    : `${formatDate(span.start)} – ${formatDate(span.end)}`;
}

/**
 * Diagrama de Gantt (HU-27) con una cuadrícula de CSS, sin librería. Cada tarea lleva dos barras:
 * arriba la planeada (color por estado, roja si venció) y abajo la real (ADR-0004 §2.1). Los grupos
 * llevan una barra resumen; las tareas de tipo Entregable, un rombo. Línea vertical en hoy.
 */
export function GanttChart({
  rows,
  range,
  zoom,
  today,
  labelTitle = 'Tarea',
}: {
  rows: GanttRow[];
  range: DayRange;
  zoom: GanttZoom;
  today: string;
  /** Encabezado de la columna de nombres */
  labelTitle?: string;
}) {
  const dayWidth = GANTT_DAY_WIDTH[zoom];
  const timelineWidth = (daysBetween(range.start, range.end) + 1) * dayWidth;
  const ticks = ganttTicks(range, zoom);
  const todayLeft = daysBetween(range.start, today) * dayWidth + dayWidth / 2;

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="relative" style={{ width: LABEL_WIDTH + timelineWidth }}>
        {/* Fondo: líneas de cada semana o mes y la de hoy */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0"
          style={{ left: LABEL_WIDTH, width: timelineWidth }}
        >
          {ticks.map((tick) => (
            <div
              key={tick.date}
              className="absolute inset-y-0 border-l border-border/70"
              style={{ left: daysBetween(range.start, tick.date) * dayWidth }}
            />
          ))}
          <div className="absolute inset-y-0 w-0.5 bg-warning" style={{ left: todayLeft }} />
        </div>

        <div className="flex h-8 border-b text-xs text-muted-foreground">
          <div
            className="sticky left-0 z-20 flex shrink-0 items-center bg-card px-3 font-medium"
            style={{ width: LABEL_WIDTH }}
          >
            {labelTitle}
          </div>
          <div className="relative" style={{ width: timelineWidth }}>
            {ticks.map((tick) => (
              <span
                key={tick.date}
                className="absolute top-2 pl-1 whitespace-nowrap"
                style={{ left: daysBetween(range.start, tick.date) * dayWidth }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>

        {rows.map((row) => (
          <Row key={row.key} row={row} range={range} zoom={zoom} timelineWidth={timelineWidth} />
        ))}
      </div>
    </div>
  );
}

function Row({
  row,
  range,
  zoom,
  timelineWidth,
}: {
  row: GanttRow;
  range: DayRange;
  zoom: GanttZoom;
  timelineWidth: number;
}) {
  const { bars, group } = row;
  const noDates = !bars.planned && !bars.real && !bars.milestone;
  const plannedClass = bars.overdue
    ? 'bg-destructive/70'
    : row.status
      ? PLANNED_CLASS[row.status]
      : 'bg-primary/25';
  const name = row.onOpen ? (
    <button type="button" onClick={row.onOpen} className="truncate text-left hover:underline">
      {row.label}
    </button>
  ) : (
    <span className="truncate">{row.label}</span>
  );

  return (
    <div className={cn('relative flex h-10 border-b last:border-0', group && 'bg-muted/40')}>
      <div
        className={cn(
          'sticky left-0 z-20 flex shrink-0 items-center gap-1 px-3 text-sm',
          group ? 'bg-muted font-semibold' : 'bg-card',
        )}
        style={{ width: LABEL_WIDTH, paddingLeft: `${0.75 + row.depth * 1.25}rem` }}
      >
        {group && (
          <button
            type="button"
            onClick={group.onToggle}
            aria-expanded={group.open}
            aria-label={group.open ? 'Plegar' : 'Desplegar'}
            className="shrink-0 rounded hover:bg-background"
          >
            {group.open ? (
              <ChevronDown aria-hidden className="size-4" />
            ) : (
              <ChevronRight aria-hidden className="size-4" />
            )}
          </button>
        )}
        {name}
        {group && (
          <span className="shrink-0 font-normal text-muted-foreground">({group.count})</span>
        )}
        {noDates && (
          <span className="shrink-0 text-xs font-normal text-muted-foreground">· sin fechas</span>
        )}
      </div>
      <div className="relative" style={{ width: timelineWidth }}>
        {bars.planned &&
          (group ? (
            <Bar
              range={range}
              span={bars.planned}
              zoom={zoom}
              className="top-3 h-2 rounded-sm bg-foreground/60"
              title={`Planeado: ${spanText(bars.planned)}`}
            />
          ) : (
            <Bar
              range={range}
              span={bars.planned}
              zoom={zoom}
              className={cn('top-1.5 h-4 rounded', plannedClass)}
              title={`Planeado: ${spanText(bars.planned)}${row.status ? ` · ${TASK_STATUSES[row.status]}` : ''}${bars.overdue ? ' · vencida' : ''}`}
            />
          ))}
        {bars.real && (
          <Bar
            range={range}
            span={bars.real}
            zoom={zoom}
            className="top-6 h-1.5 rounded-full bg-primary"
            title={`Real: ${spanText(bars.real)}`}
          />
        )}
        {bars.milestone && (
          <span
            title={`Entrega: ${formatDate(bars.milestone)}`}
            className={cn(
              'absolute top-2.5 size-3.5 rotate-45',
              bars.overdue ? 'bg-destructive' : 'bg-primary',
            )}
            style={{
              left:
                ganttBox(range, { start: bars.milestone, end: bars.milestone }, zoom).left +
                GANTT_DAY_WIDTH[zoom] / 2 -
                7,
            }}
          />
        )}
      </div>
    </div>
  );
}

function Bar({
  range,
  span,
  zoom,
  className,
  title,
}: {
  range: DayRange;
  span: DayRange;
  zoom: GanttZoom;
  className: string;
  title: string;
}) {
  const box = ganttBox(range, span, zoom);
  return (
    <span
      title={title}
      className={cn('absolute', className)}
      style={{ left: box.left, width: Math.max(box.width, 3) }}
    />
  );
}

const ZOOMS: { id: GanttZoom; label: string }[] = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'quarter', label: 'Trimestre' },
];

/** Zoom (en la URL) y leyenda de colores */
export function GanttToolbar({
  zoom,
  onZoom,
}: {
  zoom: GanttZoom;
  onZoom: (zoom: GanttZoom) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Zoom" className="inline-flex rounded-md border p-0.5">
        {ZOOMS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={zoom === item.id}
            onClick={() => onZoom(item.id)}
            className={cn(
              'rounded px-3 py-1 text-sm',
              zoom === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <GanttLegend />
    </div>
  );
}

function GanttLegend() {
  const item = (swatch: ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {item(<span className="h-3 w-5 rounded bg-primary/25" />, 'Planeado')}
      {item(<span className="h-1.5 w-5 rounded-full bg-primary" />, 'Real')}
      {item(<span className="h-3 w-5 rounded bg-destructive/70" />, 'Vencida')}
      {item(<span className="h-2 w-5 rounded-sm bg-foreground/60" />, 'Fase (calculada)')}
      {item(<span className="size-2.5 rotate-45 bg-primary" />, 'Entregable')}
      {item(<span className="h-3 w-0.5 bg-warning" />, 'Hoy')}
    </div>
  );
}
