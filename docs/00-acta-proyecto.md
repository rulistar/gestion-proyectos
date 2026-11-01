# Acta de Constitución del Proyecto (Project Charter)

> Documento PMI de la fase de Inicio. Autoriza el proyecto y define su marco. Se actualiza solo con decisiones formales.

| Campo | Valor |
|---|---|
| Nombre | Gestor de Proyectos (nombre comercial por definir) |
| Patrocinador / Product Owner | Tú |
| Equipo de desarrollo | Tú + Claude (guía/arquitecto) + Claude Code (implementación) |
| Fecha de inicio | 2026-10-22 |
| Metodología | Híbrido: PMI (gobierno, alcance, riesgos) + Scrum (ejecución en sprints de 2 semanas) |

## 1. Propósito
Construir una aplicación web profesional para gestionar proyectos personales y de un equipo pequeño, diseñada para crecer por módulos e integrarse con otras aplicaciones (p. ej. la app de estudio: cursos + Lexika).

## 2. Objetivos medibles (SMART)
1. MVP en producción (gratuito) al cierre del Sprint 3: usuarios, proyectos, tareas, tablero por estado.
2. 0 vulnerabilidades críticas/altas en dependencias en cada release (escaneo automático).
3. Cobertura de pruebas ≥ 70 % en la lógica de negocio del backend.
4. API pública documentada (OpenAPI) lista para la primera integración antes del Sprint 6.

## 3. Alcance
**Incluye (MVP, basado en el prototipo previo):**
- Autenticación de usuarios y roles (Admin, Miembro, Lector).
- Espacios de trabajo (workspace) → proyectos → fases/entregables → tareas.
- Pantalla principal en tabla con filtros (estado, prioridad, fechas, clasificación).
- Tablero por estado (Kanban) y vista de detalle.
- Fechas de inicio/fin, % de avance, días restantes.
- Gráficas: proyectos por mes de término y resumen por estado (mostrar/ocultar).
- Respaldo e importación JSON/Excel (actualizar o reemplazar).

**Fuera de alcance (por ahora):** app móvil nativa, facturación, chat en tiempo real, multiempresa (SaaS).

**Siguientes incrementos (backlog futuro):** Gantt, registro de riesgos, interesados, bitácora de auditoría, notificaciones, webhooks, tokens de API para apps externas, integración con app de estudio.

## 4. Interesados (Stakeholders)
| Interesado | Interés | Influencia |
|---|---|---|
| Tú (PO / usuario principal) | Funcionalidad y aprendizaje | Alta |
| Miembros del equipo pequeño | Usabilidad, permisos | Media |
| App de estudio (sistema externo) | API estable | Media |

## 5. Supuestos y restricciones
- Presupuesto de infraestructura: $0 (capas gratuitas).
- Un solo lenguaje: TypeScript.
- Desarrollo a tiempo parcial.
- Las capas gratuitas pueden "dormir" o cambiar sus condiciones.

## 6. Riesgos iniciales
| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| Curva de aprendizaje del stack | Alta | Media | Sprints cortos, explicación en cada paso |
| Cambio de condiciones del hosting gratuito | Media | Media | Contenedores Docker → portabilidad |
| Fuga de secretos (contraseñas, llaves) | Media | Alta | `.env` fuera de Git + escaneo automático |
| Crecimiento desordenado del alcance | Alta | Alta | Backlog priorizado; nada entra sin historia de usuario |
| Pérdida de datos | Baja | Alta | Respaldos automáticos de la BD + export JSON |

## 7. Definición de Terminado (Definition of Done)
Una historia está terminada solo si: el código está en `main` vía Pull Request, pasan las pruebas y el linter, el escaneo de seguridad no reporta problemas altos, está documentada y funciona en el entorno desplegado.

## 8. Aprobación
Aprobado por el Product Owner: ____________ Fecha: ________

## 9. Cierre de la versión 1
La versión 1.0 se cerró el **2026-11-01**, al terminar el Sprint 7: se cumplió todo el alcance del MVP (§3), con "reemplazar" fuera de la importación por decisión del PO, y se adelantó el Gantt. Objetivos (§2): el 2 se cumplió; el 1 y el 4, con retraso; el 3 (cobertura) no se midió. Las integraciones pasan a la versión 2. Detalle, indicadores y lecciones aprendidas: [cierre-v1.md](cierre-v1.md). Esta acta rige hasta que se apruebe la de la versión 2.
