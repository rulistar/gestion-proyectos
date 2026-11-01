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

## Resultado (se completa al cierre)

- Puntos completados: \_\_ / 17
- Objetivo cumplido: ☐ Sí ☐ No
- Notas de la retrospectiva:
