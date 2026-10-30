import { useState } from 'react';

/**
 * Plegar y desplegar grupos por su clave. `startOpen` = cómo empiezan: el Gantt del espacio
 * empieza con los contenedores plegados para que se vean todos.
 */
export function useCollapsed(startOpen = true) {
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  return {
    isOpen: (key: string) => toggled.has(key) !== startOpen,
    toggle: (key: string) =>
      setToggled((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
  };
}
