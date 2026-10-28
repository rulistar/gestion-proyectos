import { createContext, useCallback, useContext, useState } from 'react';

/** Lee la preferencia guardada; si el navegador bloquea el almacenamiento, se muestra */
function readSaved(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Algo que se muestra u oculta y que cada navegador recuerda (localStorage): es una comodidad,
 * no un dato de la aplicación ni algo sensible. Empieza visible.
 */
export function useSavedToggle(key: string) {
  const [open, setOpen] = useState(() => readSaved(key));
  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Sin almacenamiento solo se pierde el recuerdo al recargar
      }
      return next;
    });
  }, [key]);
  return { open, toggle };
}

/** Menú lateral visible u oculto (HU-40) */
export function useMenuOpen() {
  return useSavedToggle('menu-lateral-visible');
}

/** Si el menú lateral está visible, para las páginas que aprovechan el espacio extra (HU-46) */
export const MenuOpenContext = createContext(true);

export function useIsMenuOpen(): boolean {
  return useContext(MenuOpenContext);
}
