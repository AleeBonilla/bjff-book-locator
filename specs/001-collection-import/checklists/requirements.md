# Specification Quality Checklist: Carga administrativa inicial de la colección

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-30
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

Todas las validaciones pasan. La especificación está lista para `/speckit-plan`.

Decisiones registradas, en su estado final:

- **FR-018** — todo valor no canónico del número DDC, incluido el agrupamiento Dewey,
  se normaliza para derivar la clave y marca la fila para revisión. Es una sola regla.
  Una versión anterior eximía al agrupamiento; se revirtió al comprobar que afecta a
  muy pocos registros y que la regla partida era a la vez menos segura y más compleja.
- **FR-026a** — la importación es síncrona: la persona administradora recibe el
  resultado en la misma acción. Una versión anterior la procesaba en segundo plano;
  se revirtió por complejidad injustificada para el volumen real, y `SC-006` se ajustó
  a 30 segundos para que la espera sea razonable.
- **FR-029 / FR-028a** — ninguna carga bloquea a otra, y solo una carga en `DONE`
  expone registros. Al eliminar la serialización desaparece la posibilidad de que una
  carga `PENDING` huérfana deje el sistema bloqueado; al enunciar la garantía en
  positivo, una carga huérfana queda inerte sin necesidad de recuperarla. Se evaluó
  reponer la serialización y se descartó: las cargas son independientes por diseño, de
  modo que la concurrencia no puede corromper nada y el bloqueo solo añadiría
  maquinaria.
- **FR-032** — una discrepancia entre el pie `TOTAL;n` y las filas leídas termina la
  carga en `ERROR` sin dejar registros disponibles. Es coherente con la regla de que
  una importación fallida no debe dejar una carga parcialmente utilizable.

`bjff-collection-example.csv` se extendió de 36 a 44 filas para cubrir cada regla de
anomalía especificada. Los contadores de `SC-002` se verificaron contra ese archivo.

La especificación se contrastó después contra la exportación oficial en un entorno
autorizado. Esa revisión corrigió cuatro puntos: el marcador `0` de ausencia de año,
que habría marcado para revisión decenas de registros correctos; la distinción entre
el agrupamiento Dewey y el espacio inmediatamente posterior al punto; el espacio junto
a un guion del Cutter; y la exigencia explícita de un lector CSV que respete el
entrecomillado. También confirmó que el conteo del pie coincide con las filas de la
exportación vigente, de modo que la regla de FR-032 no la bloquea.

La verificación de privacidad pasa: ningún dato ni estadística de
`bjff-collection.csv` o de `docs/dataset.md` aparece en la especificación. Todos los
ejemplos provienen de `bjff-collection-example.csv` o de `docs/clasificacion.md`,
ambos publicables.

Trazabilidad de las 7 historias del encargo original: US1 (acceso), US2 (selección e
importación), US4 (validación de formato), US5 (fila vacía y pie), US3
(normalización determinista), US6 (conteos) y US7 (consulta). El orden de prioridad
difiere del orden del encargo porque la normalización y la validación de formato
condicionan el valor de las historias posteriores.
