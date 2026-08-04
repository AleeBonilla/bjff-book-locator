# Preguntas abiertas

Este documento conserva incertidumbres materiales hasta resolverlas. Una entrada
cerrada no se borra: registra su resolución y enlaza la decisión resultante cuando
corresponda.

## Preguntas

### PA-001 — Estado formal de funcionalidades implementadas

- **Estado:** ABIERTA
- **Detectada:** 2026-07-30
- **Contexto:** `specs/001-collection-import/spec.md` y
  `specs/002-load-management/spec.md` siguen en `Draft`, aunque el código y el README
  presentan ambas funcionalidades como implementadas.
- **Pregunta:** ¿Qué estados formales debe usar una especificación y quién aprueba el
  cambio de `Draft` al estado correspondiente?
- **Impacto:** no existe una señal documental inequívoca para distinguir una
  especificación propuesta de una ya aceptada e implementada.
- **Siguiente paso:** definir el ciclo de estados de las especificaciones y actualizar
  las funcionalidades 001 y 002.
- **Relacionada con:** principio IV de `.specify/memory/constitution.md`.

### PA-002 — Baseline de formato

- **Estado:** ABIERTA
- **Detectada:** 2026-07-30
- **Contexto:** `npm run format:check` reporta 127 archivos fuera del formato de
  Prettier.
- **Pregunta:** ¿Debe normalizarse todo el repositorio en un cambio dedicado o deben
  excluirse del chequeo los artefactos generados por Spec Kit?
- **Impacto:** la puerta de formato no puede utilizarse como verificación confiable
  mientras falle sobre el estado base.
- **Siguiente paso:** acordar el alcance de Prettier y ejecutar la normalización o
  ajustar `.prettierignore`.
- **Relacionada con:** `.prettierrc`, `.prettierignore` y el script `format:check`.

### PA-003 — Autoría de settings copiados entre schemes

- **Estado:** ABIERTA
- **Detectada:** 2026-07-31
- **Contexto:** la implementación de la copia definida por
  `specs/003-structure-modeling/spec.md` duplica cada fila vigente de
  `location_distribution_settings`, pero los artefactos no indican si `updated_by`
  debe conservar a la persona que configuró el origen o registrar a quien ejecutó la
  copia.
- **Pregunta:** ¿Qué persona debe aparecer como responsable del setting vigente en el
  nuevo scheme: la autora del valor original o la autora de la copia?
- **Impacto:** la elección cambia la interpretación de auditoría en schemes derivados
  y podría atribuir un valor a alguien que no lo decidió.
- **Siguiente paso:** acordar la semántica de autoría de una configuración copiada y
  actualizar `docs/decisiones.md`, el contrato de 003 y la prueba de copia.
- **Relacionada con:** FR-044 y FR-049 de
  `specs/003-structure-modeling/spec.md`, decisión 7 de `docs/decisiones.md` y
  `location_distribution_settings.updated_by` en `docs/db.md`.
