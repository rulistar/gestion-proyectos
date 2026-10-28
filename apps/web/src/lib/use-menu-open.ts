import { useCallback, useState } from 'react';

const STORAGE_KEY = 'menu-lateral-visible';

/** Lee la preferencia guardada; si el navegador bloquea el almacenamiento, el menú se muestra */
function readSaved(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Menú lateral visible u oculto (HU-40). Es una comodidad de cada navegador: se recuerda en
 * localStorage (no es un dato de la aplicación ni algo sensible).
 */
export function useMenuOpen() {
  const [open, setOpen] = useState(readSaved);
  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Sin almacenamiento solo se pierde el recuerdo al recargar
      }
      return next;
    });
  }, []);
  return { open, toggle };
}
