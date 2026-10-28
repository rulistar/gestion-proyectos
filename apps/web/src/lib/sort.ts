/** Utilidades para ordenar tablas por columna (HU-09, HU-39) */

/** Siguiente orden al hacer clic: la misma columna se invierte; otra empieza ascendente */
export function nextSort<K extends string>(
  current: { sort?: K | undefined; dir?: 'asc' | 'desc' | undefined },
  column: K,
): { sort: K; dir: 'asc' | 'desc' } {
  return { sort: column, dir: current.sort === column && current.dir !== 'desc' ? 'desc' : 'asc' };
}
