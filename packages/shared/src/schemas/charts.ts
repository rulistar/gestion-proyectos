import type { Project, ProjectStatus } from './projects.js';

/**
 * Gráficas e indicadores (HU-12, decisión del PO 2026-11-01). Cálculos puros: la web les pasa la
 * lista ya filtrada y `localDate`, que convierte un instante a la fecha local de quien mira (así
 * algo terminado a las 20:00 del día límite en México no cuenta como tarde por la hora UTC).
 */
type LocalDate = (instant: string) => string;

const DAY_MS = 86_400_000;

/** Días entre dos fechas AAAA-MM-DD (b − a) */
function daysBetweenDates(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Un mes de la gráfica "por mes de término": cuántos terminaron a tiempo, tarde o siguen abiertos */
export interface EndMonthBucket {
  /** 1 = enero … 12 = diciembre */
  month: number;
  onTime: number;
  late: number;
  open: number;
}

export interface EndMonthChart {
  months: EndMonthBucket[];
  /** Sin fecha fin planeada */
  noDate: number;
  /** Con fin planeado en otro año (p. ej. un abierto de 2026 que vence en 2027) */
  otherYears: number;
}

type EndMonthFacts = Pick<Project, 'status' | 'endDate' | 'finishedAt'>;

/**
 * Contenedores por mes de su fin planeado, en el año elegido. Terminado a tiempo = fin real ≤ fin
 * planeado; un Terminado sin fin real (cerrado antes de ADR-0004 §2.1) cuenta a tiempo: no hay cómo
 * saber que fue tarde. Los cancelados no cuentan aquí (sí en la gráfica por estado).
 * Ej.: "Portal" (fin 2026-03-31, terminado el 28/03) → marzo, a tiempo; "ERP" (fin 2026-03-15,
 * terminado el 2/04) → marzo, tarde; "Lab" (fin 2026-05-10, en curso) → mayo, abierto.
 */
export function projectsByEndMonth(
  projects: readonly EndMonthFacts[],
  year: number,
  localDate: LocalDate,
): EndMonthChart {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    onTime: 0,
    late: 0,
    open: 0,
  }));
  let noDate = 0;
  let otherYears = 0;
  for (const project of projects) {
    if (project.status === 'CANCELLED') continue;
    if (!project.endDate) {
      noDate++;
      continue;
    }
    if (Number(project.endDate.slice(0, 4)) !== year) {
      otherYears++;
      continue;
    }
    const bucket = months[Number(project.endDate.slice(5, 7)) - 1]!;
    if (project.status !== 'DONE') bucket.open++;
    else if (project.finishedAt && localDate(project.finishedAt) > project.endDate) bucket.late++;
    else bucket.onTime++;
  }
  return { months, noDate, otherYears };
}

const STATUS_ORDER: ProjectStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED'];

/** Contenedores por estado, en el orden del tablero */
export function projectsByStatus(
  projects: readonly Pick<Project, 'status'>[],
): { status: ProjectStatus; count: number }[] {
  return STATUS_ORDER.map((status) => ({
    status,
    count: projects.filter((project) => project.status === status).length,
  }));
}

/** Lo que necesita un indicador de tiempos: una tarea Hecha o un contenedor Terminado */
export interface TimedItem {
  typeName: string;
  createdAt: string;
  startedAt: string | null;
  /** Fin real: completedAt de la tarea o finishedAt del contenedor */
  finishedAt: string | null;
  /** Fin planeado */
  endDate: string | null;
}

/** Indicadores de tiempos de un tipo (ADR-0004 §2.1); null = sin datos para calcularlo */
export interface TimeIndicator {
  typeName: string;
  count: number;
  /** Creación → inicio real, en días */
  waitDays: number | null;
  /** Inicio real → fin real */
  workDays: number | null;
  /** Creación → fin real */
  leadDays: number | null;
  /** % con fin real ≤ fin planeado (de los que tienen fin planeado) */
  onTimePercent: number | null;
  /** Promedio de fin real − fin planeado; positivo = tarde */
  deviationDays: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

const elapsedDays = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / DAY_MS;

/**
 * Indicadores por tipo de lo que terminó en el año elegido (por la fecha local del fin real). Solo
 * cuenta lo terminado: lo abierto aún no tiene tiempos reales. El que más se usa, primero.
 * Ej.: dos Incidencias creadas el 1/03, iniciadas el 2/03 y terminadas el 3/03 y 5/03 con fin
 * planeado 4/03 → espera 1 d, trabajo 2 d, atención 3 d, 50 % a tiempo, desviación 0 d.
 */
export function timeIndicators(
  items: readonly TimedItem[],
  year: number,
  localDate: LocalDate,
): TimeIndicator[] {
  const byType = new Map<string, TimedItem[]>();
  for (const item of items) {
    if (!item.finishedAt || Number(localDate(item.finishedAt).slice(0, 4)) !== year) continue;
    byType.set(item.typeName, [...(byType.get(item.typeName) ?? []), item]);
  }
  return [...byType.entries()]
    .map(([typeName, group]) => {
      const planned = group.filter((item) => item.endDate);
      const deviations = planned.map((item) =>
        daysBetweenDates(item.endDate!, localDate(item.finishedAt!)),
      );
      const started = group.filter((item) => item.startedAt);
      return {
        typeName,
        count: group.length,
        waitDays: average(started.map((item) => elapsedDays(item.createdAt, item.startedAt!))),
        workDays: average(started.map((item) => elapsedDays(item.startedAt!, item.finishedAt!))),
        leadDays: average(group.map((item) => elapsedDays(item.createdAt, item.finishedAt!))),
        onTimePercent:
          planned.length === 0
            ? null
            : Math.round((deviations.filter((d) => d <= 0).length / planned.length) * 100),
        deviationDays: average(deviations),
      };
    })
    .sort((a, b) => b.count - a.count || a.typeName.localeCompare(b.typeName));
}

/** Años con algo terminado, más el en curso; el más reciente primero */
export function indicatorYears(
  items: readonly Pick<TimedItem, 'finishedAt'>[],
  currentYear: number,
  localDate: LocalDate,
): number[] {
  const years = new Set([currentYear]);
  for (const item of items) {
    if (item.finishedAt) years.add(Number(localDate(item.finishedAt).slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}
