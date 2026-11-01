# Sprint 7 — Planificación

| Campo | Valor |
|---|---|
| Fechas | **2026-11-01 → 2026-11-14** |
| Capacidad | 5–10 h/semana (PO + Claude Code). Velocidad: Sprint 5 = 56 pts, Sprint 6 = 48 pts (16 agregados a mitad del sprint); el límite real es el tiempo del PO para probar |
| Compromiso | **17 puntos** |

## Objetivo del sprint

> **"Termino la versión 1: veo las gráficas del acta, comparto el catálogo de personas entre espacios y la API queda documentada y probada de punta a punta."**

## Elementos comprometidos

| Orden | ID | Elemento | Pts |
|---|---|---|---|
| 1 | TEC-11 | Corregir la prueba que falla al azar (límite de intentos de Mi perfil) | 1 |
| 2 | HU-12 | Gráficas por mes de término y por estado, e indicadores de tiempos (ADR-0004 §2.1) | 5 |
| 3 | HU-50 | Catálogo de personas compartido entre espacios (diseño confirmado en el Sprint 5) | 5 |
| 4 | TEC-05 | Documentación OpenAPI (Swagger) | 3 |
| 5 | TEC-06 | Pruebas de extremo a extremo con Playwright | 3 |
| | | **Total** | **17** |

**Por qué este orden:**
- **TEC-11 primero.** Es chica y evita que el CI falle al azar el resto del sprint.
- **Gráficas después.** Son lo único del MVP del acta que falta.
- **Swagger y Playwright al final.** Documentan y prueban la v1 ya completa.

**Decisiones del PO (2026-10-31):**
- **La versión 1 termina con este sprint.** Las integraciones (TEC-08 a HU-20) pasan a la versión 2, porque la app de estudio todavía no existe.
- El compromiso queda por debajo de la velocidad para dejar espacio a lo que se pida a mitad del sprint.

Detalle y criterios de aceptación: [backlog.md](../backlog.md).

**Lo que el PO pida a mitad del sprint** se anota aquí el mismo día, con sus puntos. Si no cabe, se dice qué historia comprometida sale:

| Fecha | ID | Elemento | Pts | Sale |
|---|---|---|---|---|

## Dependencias nuevas

TEC-05 y TEC-06 instalan lo que el ADR-0001 deja pendiente: **Swagger/OpenAPI** y **Playwright**. Antes de instalar cada una, se le confirma al PO el paquete exacto y para qué sirve. HU-12 se intentará sin librería de gráficas; si hace falta una, se pregunta antes.

## Guion de demostración (en producción)

1. **Proyectos** → gráficas por mes de término y por estado, que se muestran y se ocultan, más los indicadores de tiempos.
2. **Personas** de un espacio: una persona del catálogo compartido aparece también en el otro espacio.
3. Abrir la documentación de la API (Swagger) y probar un endpoint de lectura.
4. En la terminal, `pnpm test:e2e`: el recorrido de inicio de sesión, proyecto y tarea pasa en el navegador.

## Riesgos del sprint

| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| Playwright necesita un navegador que Smart App Control bloquee | Media | Media | Probarlo primero; si se bloquea, correrlo solo en el CI |
| Las gráficas sin librería quedan pobres | Media | Baja | Barras con CSS como el Gantt; si no basta, proponer una librería |
| HU-50 cambia el modelo de personas | Media | Alta | Diseño ya confirmado; migración creada una vez y revisada |

## Después del Sprint 7: cierre de la versión 1

Plan acordado con el PO (2026-10-31):

1. **Cierre formal (PMI):** etiqueta `v1.0` en Git con notas de la versión, lecciones aprendidas de los 7 sprints y acta marcada como cerrada.
2. **Uso real durante 2 a 4 semanas.** El PO anota sus observaciones (plantilla en `docs/`).
3. **Tres opiniones para la versión 2:**
   - el **análisis profesional de Claude Code**, hecho en una sesión nueva para reducir el sesgo: funcional contra PMBOK y Scrum, experiencia de uso, técnica (arquitectura, seguridad, rendimiento, pruebas, deuda) y propuesta priorizada (MoSCoW);
   - las **observaciones del PO** después del uso;
   - la **revisión de otra IA**, a partir de una descripción detallada de la aplicación que Claude Code prepara al cerrar la v1 (sin secretos), con la misma estructura para poder comparar.
4. **Acta y backlog de la versión 2:** la app en Android (tablet y celular; recomendada como PWA, en línea primero), las integraciones con la app de estudio y las mejoras que salgan del análisis.

## Eventos del sprint

| Evento | Cuándo | Qué se hace |
|---|---|---|
| Planificación | 2026-10-31 | Este documento ✅ |
| Seguimiento | En cada sesión de trabajo | Revisar el avance y los bloqueos |
| Revisión | Al terminar las 5 historias | El guion de arriba, en producción |
| Retrospectiva | Junto con la revisión | Qué salió bien, qué mejorar; incluye las lecciones aprendidas de la v1 |

## Resultado (cierre: 2026-11-01)

- Puntos completados: **17 / 17 comprometidos**. No se pidió nada a mitad del sprint.
- Objetivo cumplido: ☑ Sí. El PO aprobó el cierre y la retrospectiva el 2026-11-01.
- Se cerró el primer día del sprint: el compromiso era chico a propósito (último sprint de la v1).

### Revisión

| ID | Historia | Pts | PR |
|---|---|---|---|
| — | Cierre del Sprint 6 y planificación del 7; folio fijo en una prueba de exportar | — | #93, #94 |
| TEC-11 | La prueba del límite de intentos ya no falla al azar | 1 | #95 |
| HU-12 | Gráficas por mes de término y por estado (arriba de cada lista) y página Indicadores por tipo | 5 | #96 |
| HU-50 | Personas compartidas entre espacios | 5 | #97 |
| TEC-05 | Documentación OpenAPI en /api/v1/docs (en producción, con sesión) | 3 | #98 |
| TEC-06 | Recorrido en el navegador con Playwright; 4.º check obligatorio del CI | 3 | #99 |

- 426 pruebas en verde: 313 de la API, 112 de shared y el recorrido de Playwright.
- Tres dependencias nuevas, las que el ADR-0001 dejaba pendientes y aprobadas por el PO antes de instalarlas: `@fastify/swagger`, `@fastify/swagger-ui` y `@playwright/test`. Las gráficas se hicieron sin librería.
- Una migración (`person_shares_hu50`), creada una vez y revisada antes de aplicarla.
- La protección de `main` (ruleset) exige ahora 4 checks: lint/tipos/pruebas, auditoría, gitleaks y Playwright.
- Cada fusión se confirmó en producción.

**Recorrido del MVP del acta** (objetivo 1):

| Alcance del acta (§3) | Estado |
|---|---|
| Usuarios con invitación y roles; espacios → proyectos → fases → tareas | ✅ |
| Tabla con filtros, tablero Kanban y vista de detalle | ✅ |
| Fechas, % de avance y días restantes | ✅ |
| Respaldo e importación JSON/Excel | ✅ solo "actualizar"; "reemplazar" quedó fuera por decisión del PO |
| Gráficas por mes de término y por estado | ✅ HU-12 |
| Gantt (era backlog futuro) | ✅ adelantado en el Sprint 6 |

Objetivo 4 del acta (API documentada con OpenAPI): ✅ con TEC-05, un sprint después de lo planeado.

**Riesgos del sprint:** Smart App Control no bloqueó Playwright, porque en la PC del PO usa el Edge instalado; en el CI usa Chromium. Las gráficas con CSS bastaron. La migración de HU-50 no dio problemas.

### Retrospectiva

Borrador de Claude Code; el PO lo ajusta.

**Salió bien**

- Se entregaron los 17 puntos y se cumplió lo que faltaba del acta: las gráficas y la API documentada.
- Cada dependencia nueva se confirmó con el PO (paquete exacto, versión con más de dos semanas y quién ve la documentación) antes de instalarla.
- El riesgo de Smart App Control se resolvió preguntando antes de instalar, y la prueba corrió en la PC del PO a la primera.
- TEC-11 se atacó por la causa real: al revisarla se corrigió un diagnóstico equivocado (no era el cambio de minuto) y se dijo así.

**A mejorar**

- En HU-50 se agregaron cuatro reglas para no duplicar personas que no estaban en el diseño confirmado; se avisaron en el PR, pero conviene confirmarlas antes de construir.
- Una vez el PO dijo "listo" antes de crear el PR de TEC-11; se detectó revisando GitHub. Seguir confirmando el estado del PR antes de continuar.
- El paquete de la web pesa 850 kB (Vite avisa por pasar de 500 kB). No es urgente con pocos usuarios, pero importa para la app en Android de la v2.

**Lecciones de la versión 1** (7 sprints): van en el cierre formal de la v1, siguiente paso del plan de abajo.
