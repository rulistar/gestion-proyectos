import { VIEW_AS_HEADER, viewAsSchema, type ViewAs } from '@gestion/shared';
import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Ver como un miembro (HU-56): el Admin del espacio ve lo que ve otra persona, sin entrar con su
 * cuenta. Se guarda en esta pestaña (sessionStorage: solo el ID y el nombre, nada secreto) y
 * apiFetch manda el encabezado en las llamadas de ese espacio. La API decide con el acceso de esa
 * persona y rechaza cualquier cambio: es solo lectura.
 */

const STORAGE_KEY = 'ver-como';
const listeners = new Set<() => void>();
let current: ViewAs | null = read();

function read(): ViewAs | null {
  try {
    const parsed = viewAsSchema.safeParse(
      JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function persist(value: ViewAs | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento (ventana privada estricta): dura hasta recargar la página
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getViewAs() {
  return current;
}

export function useViewAs() {
  return useSyncExternalStore(subscribe, getViewAs);
}

/**
 * Empieza (o termina, con null) la vista como otra persona. Lo cacheado del espacio era de la otra
 * vista: se descarta y se vuelve a pedir.
 */
export function setViewAs(queryClient: QueryClient, next: ViewAs | null) {
  const previous = current;
  current = next;
  persist(next);
  listeners.forEach((listener) => listener());
  for (const workspaceId of new Set([previous?.workspaceId, next?.workspaceId])) {
    if (workspaceId) void queryClient.resetQueries({ queryKey: ['workspaces', workspaceId] });
  }
}

/** ¿La ruta de la API es del espacio que se está viendo como otra persona? */
export function viewAsFor(path: string): ViewAs | null {
  if (!current) return null;
  const prefix = `/workspaces/${current.workspaceId}`;
  const matches = path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
  return matches ? current : null;
}

export const viewAsHeader = (viewAs: ViewAs) => ({ [VIEW_AS_HEADER]: viewAs.userId });
