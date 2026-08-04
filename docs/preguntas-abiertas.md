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

### PA-004 — Redondeo del objetivo en libros

- **Estado:** RESUELTA
- **Detectada:** 2026-08-03
- **Contexto:** una corrida con capacidad `BOOKS` puede producir un objetivo
  fraccionario al aplicar `target_fill_ratio`.
- **Pregunta:** ¿Ese objetivo debe redondearse hacia abajo, al entero más cercano o
  hacia arriba?
- **Impacto:** distintas reglas pueden mover fronteras, cambiar sobrecargas y producir
  resultados diferentes con las mismas capacidades.
- **Resolución:** el 2026-08-03 se acordó redondear siempre hacia abajo al entero
  inmediato inferior.
- **Siguiente paso:** aplicar y probar la regla definida por FR-020 durante la
  implementación.
- **Relacionada con:** `docs/problema-distribucion.md`, sección 11 de `docs/db.md` y
  `specs/004-distribution-search/spec.md`; decisión 35 de `docs/decisiones.md`.

### PA-005 — Publicación con registros sin asignar

- **Estado:** RESUELTA
- **Detectada:** 2026-08-03
- **Contexto:** el modelo conserva `unassigned_count` y la vista previa muestra esos
  registros, pero el flujo solo exige que no existan errores bloqueantes para publicar.
- **Pregunta:** ¿Los registros sin asignar deben bloquear la publicación, permitirla
  con advertencia y confirmación explícita, o permitirla sin confirmación adicional?
- **Impacto:** la respuesta define cuándo una corrida incompleta puede convertirse en
  el resultado público y qué advertencia debe aceptar el personal.
- **Resolución:** el 2026-08-03 se acordó permitir la publicación, pero solo después de
  mostrar la cantidad sin asignar como advertencia y obtener una confirmación explícita
  adicional.
- **Siguiente paso:** aplicar y probar la confirmación definida por FR-042 durante la
  implementación.
- **Relacionada con:** secciones 11, 14 y 15 de `docs/flujo.md` y
  `specs/004-distribution-search/spec.md`; decisión 36 de `docs/decisiones.md`.

### PA-006 — Revisión posterior a la publicación

- **Estado:** RESUELTA
- **Detectada:** 2026-08-04
- **Contexto:** FR-037 hace inmutables las entradas y resultados de una corrida
  publicada, mientras FR-040 permite registrar una revisión opcional, pero no define si
  `reviewed_by`, `reviewed_at` y `review_notes` pueden cambiar después de publicar.
- **Pregunta:** ¿Una corrida publicada permite registrar o modificar sus metadatos de
  revisión, o la revisión debe completarse antes de publicar y quedar inmutable?
- **Impacto:** el contrato de autorización, la interfaz y las pruebas pueden aceptar o
  rechazar de forma distinta una revisión posterior a la publicación.
- **Resolución:** el 2026-08-04 se estableció que la revisión solo puede cambiar en una
  corrida `DONE` no publicada. Al publicar, los metadatos de revisión quedan inmutables
  con la versión. La revisión sigue siendo opcional y no confirma presencia física.
- **Siguiente paso:** mantener esta restricción en el endpoint y en las pruebas de
  inmutabilidad.
- **Relacionada con:** FR-037 y FR-040 de
  `specs/004-distribution-search/spec.md`, sección 14 de `docs/flujo.md` y
  `specs/004-distribution-search/contracts/rest-api.md`; decisión 23 de
  `docs/decisiones.md`.
