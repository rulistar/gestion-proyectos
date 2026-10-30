import { useState } from 'react';

/** Plegar y desplegar grupos por su clave */
export function useCollapsed() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  return {
    isOpen: (key: string) => !collapsed.has(key),
    toggle: (key: string) =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
  };
}
