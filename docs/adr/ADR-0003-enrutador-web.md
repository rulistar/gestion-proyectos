# ADR-0003: Enrutador de la web

- **Estado:** Aceptado
- **Fecha:** 2026-10-23
- **Decide:** Product Owner, a propuesta del equipo técnico
- **Contexto:** El ADR-0001 define React + Vite + TanStack Query, pero no nombra un enrutador. TEC-03 (base del frontend) lo necesita: rutas públicas (login) y protegidas (redirigen al login sin sesión).

## Opciones evaluadas

| Criterio | React Router 8 | TanStack Router 1 |
|---|---|---|
| Madurez y comunidad | Muy alta: el más usado, desde hace 10 años | Alta, más reciente |
| Tipos de TypeScript | Básicos: un enlace mal escrito no falla al compilar | Completos: rutas, parámetros y búsqueda tipados |
| Filtros en la URL (search params) | Validación a mano | Validación con un esquema (Zod) |
| Encaje con TanStack Query | Bueno | Natural (misma familia; `loader` + `ensureQueryData`) |
| Curva de aprendizaje | Suave | Algo mayor |

## Decisión

**TanStack Router** (`@tanstack/react-router`), con **rutas definidas en código** (code-based routing).

### Por qué

1. **Los filtros viven en la URL** (HU-09: área, clasificación, estado, prioridad, fecha). Se validan con Zod como en la API, quedan tipados y un enlace compartido conserva la vista filtrada.
2. **TypeScript detecta errores de navegación al compilar** (ruta o parámetro inexistente), no al hacer clic.
3. **Hace equipo con TanStack Query**, ya aprobado en el ADR-0001.

### Por qué rutas en código y no basadas en archivos

TanStack Router también ofrece rutas generadas a partir de carpetas, pero eso exige un plugin de Vite y un archivo generado. Con pocas pantallas, las rutas en código son explícitas, fáciles de leer para quien aprende y no añaden dependencias. Si el número de pantallas crece mucho, se puede migrar con un ADR nuevo.

## Consecuencias

- Rutas protegidas con `beforeLoad`: consulta `GET /api/v1/auth/me` (cacheado por TanStack Query) y redirige a `/login` si responde 401.
- Esquemas de búsqueda (filtros) definidos con Zod en cada ruta que los use.
- Se asume una curva de aprendizaje algo mayor; cada pieza se explica en su PR.
- No se instalan las devtools del enrutador por ahora (dependencia opcional).
