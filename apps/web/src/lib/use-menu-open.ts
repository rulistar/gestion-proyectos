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

/**
 * Páginas de contenedores (HU-49b): las listas de proyectos, mantenimientos y actividades, y la
 * ficha de uno. Ahí el menú empieza oculto para dar espacio a la tabla o al tablero.
 */
const CONTAINER_PAGE = /^\/w\/[^/]+(\/(mantenimientos|actividades|p\/[^/]+))?\/?$/;

/**
 * Menú lateral visible u oculto (HU-40). En las páginas de contenedores empieza oculto cada vez
 * que se entra (HU-49b); en las demás se usa lo que el navegador recuerda.
 */
export function useMenuOpen(pathname: string) {
  const saved = useSavedToggle('menu-lateral-visible');
  const onContainerPage = CONTAINER_PAGE.test(pathname);
  // Abierto a mano en una página de contenedores: vale solo mientras no se cambie de página
  const [openedOn, setOpenedOn] = useState<string>();
  const containerOpen = openedOn === pathname;
  const { toggle: toggleSaved } = saved;
  const toggle = useCallback(() => {
    if (onContainerPage) setOpenedOn((current) => (current === pathname ? undefined : pathname));
    else toggleSaved();
  }, [onContainerPage, pathname, toggleSaved]);
  return { open: onContainerPage ? containerOpen : saved.open, toggle };
}

/** Si el menú lateral está visible, para las páginas que aprovechan el espacio extra (HU-46) */
export const MenuOpenContext = createContext(true);

export function useIsMenuOpen(): boolean {
  return useContext(MenuOpenContext);
}
