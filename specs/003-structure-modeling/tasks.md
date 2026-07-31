# Tasks: Modelado de la estructura física

**Input**: Documentos de diseño en `specs/003-structure-modeling/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/rest-api.md`, `quickstart.md`

**Tests**: Son obligatorios porque el plan define cobertura unitaria, contractual, transaccional, de seguridad y rendimiento. Dentro de cada historia, las pruebas se escriben y se comprueba que fallen antes de implementar.

**Organization**: Las tareas se agrupan por historia de usuario para que cada incremento pueda implementarse y validarse con un criterio independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo porque trabaja en archivos distintos y no depende de otra tarea incompleta.
- **[USn]**: historia de usuario de `spec.md`; solo aparece en fases de historias.
- Cada tarea nombra la ruta exacta que debe cambiar.

## Phase 1: Setup (base compartida)

**Purpose**: Preparar tipos, contratos y utilidades de prueba que usan todas las historias sin agregar migraciones ni dependencias.

- [x] T001 Ampliar el mapa Kysely con `structure_templates`, `structure_template_nodes`, `schemes`, `locations` y `location_distribution_settings`, incluidos enums y conversión de NUMERIC, en `apps/api/src/database/schema.types.ts`
- [x] T002 [P] Definir requests, respuestas, árboles, paginación, estados, disponibilidad, settings y códigos de error compartidos de 003 en `packages/api-types/src/index.ts`
- [x] T003 [P] Extender la limpieza serial de PostgreSQL y crear builders sintéticos de usuarios, plantillas, nodos, schemes y locations en `apps/api/test/setup.ts` y `apps/api/test/helpers.ts`

---

## Phase 2: Foundational (bloqueos transversales)

**Purpose**: Implementar reglas de árbol, errores y soporte común requeridos antes de las historias.

**⚠️ CRITICAL**: No iniciar implementación de historias hasta completar esta fase.

- [x] T004 Escribir pruebas unitarias inicialmente fallidas para detección de ciclos, validación de permutaciones, ramas utilizables y secuencia DFS en `apps/api/test/unit/structure-tree.spec.ts`
- [x] T005 Implementar funciones puras de ciclo, orden, recorrido, usabilidad y numeración DFS que satisfagan T004 en `apps/api/src/schemes/structure-tree.ts`
- [x] T006 Incorporar constructores para los errores de dominio de 003 y traducir violaciones conocidas de unicidad, checks y llaves PostgreSQL sin filtrar SQL en `apps/api/src/common/api-error.ts`
- [x] T007 [P] Crear DTOs comunes para paginación, posiciones, capacidad con unidad y reemplazo nullable con validación estricta en `apps/api/src/common/structure.dto.ts`

**Checkpoint**: Tipos, errores, fixtures y algoritmos compartidos están listos; las historias pueden comenzar.

---

## Phase 3: User Story 1 - Definir una plantilla reutilizable (Priority: P1) 🎯 MVP

**Goal**: Crear, editar y activar una plantilla jerárquica reutilizable, con roles CONTAINER/POSITION y borrado confirmado de subárboles.

**Independent Test**: Crear `Sección → Cara → Estantería → Anaquel`, marcar Anaquel como POSITION, activar la plantilla y comprobar que queda disponible para nuevas instancias e inmutable estructuralmente.

### Tests for User Story 1

- [x] T008 [US1] Escribir pruebas de integración inicialmente fallidas para autenticación, CRUD y paginación de plantillas/nodos, movimiento, orden, conflictos, vista previa y borrado atómico, activación válida/inválida e inmutabilidad ACTIVE en `apps/api/test/integration/structure-templates.spec.ts`

### Implementation for User Story 1

- [x] T009 [US1] Implementar DTOs de creación/edición de plantillas y CRUD, movimiento, orden y confirmación de nodos en `apps/api/src/structure-templates/structure-templates.dto.ts`
- [x] T010 [US1] Implementar persistencia ordenada, consultas de detalle, paginación, renumeración segura de hermanos y borrado hoja-a-raíz transaccional en `apps/api/src/structure-templates/structure-templates.repository.ts`
- [x] T011 [US1] Implementar reglas DRAFT/ACTIVE, raíz única, roles, nombres hermanos, ramas habilitadas, POSITION alcanzable y previsualización de subárbol en `apps/api/src/structure-templates/structure-templates.service.ts`
- [x] T012 [US1] Exponer todos los endpoints de plantillas y nodos con el guard global y registrar el módulo en `apps/api/src/structure-templates/structure-templates.controller.ts`, `apps/api/src/structure-templates/structure-templates.module.ts` y `apps/api/src/app.module.ts`
- [x] T013 [P] [US1] Añadir métodos tipados del cliente para listar, crear, consultar, editar y activar plantillas y para mutar sus nodos en `apps/web/src/api/client.ts`
- [x] T014 [P] [US1] Crear el editor de árbol accesible y el diálogo de confirmación que muestra el impacto completo del subárbol en `apps/web/src/components/TreeEditor.tsx` y `apps/web/src/components/SubtreeConfirmation.tsx`
- [x] T015 [P] [US1] Crear el listado paginado de plantillas con estado y disponibilidad visibles en `apps/web/src/pages/TemplatesPage.tsx`
- [x] T016 [US1] Crear la pantalla de edición DRAFT, roles, alta/movimiento/borrado de nodos y activación con errores por elemento en `apps/web/src/pages/TemplateEditorPage.tsx`
- [x] T017 [US1] Agregar navegación y rutas protegidas para listado, alta y edición de plantillas en `apps/web/src/App.tsx`

**Checkpoint**: US1 puede demostrarse y probarse sin crear schemes.

---

## Phase 4: User Story 2 - Modelar un scheme heterogéneo (Priority: P1)

**Goal**: Construir un scheme DRAFT con múltiples instancias y tipos de plantilla, manteniendo la correspondencia exacta entre nodo de plantilla y location.

**Independent Test**: Con fixtures que siembran dos plantillas ACTIVE, crear dos secciones y un archivador con cantidades distintas de hijas, y validar identidad, orden, parent-child mapping y rechazo de relaciones incompatibles.

### Tests for User Story 2

- [x] T018 [US2] Escribir pruebas de integración inicialmente fallidas para autenticación, CRUD/paginación de schemes, instanciación heterogénea, repetición de nodos, nombres/mapas únicos, movimiento, orden y borrado atómico de locations en `apps/api/test/integration/schemes.spec.ts`

### Implementation for User Story 2

- [x] T019 [US2] Implementar DTOs para metadatos del scheme y creación, edición, movimiento, orden y confirmación de locations sin aceptar status ni leafSequence en `apps/api/src/schemes/schemes.dto.ts`
- [x] T020 [US2] Implementar persistencia del árbol concreto, detalle anidado, paginación, renumeración segura y borrado transaccional de locations/settings en `apps/api/src/schemes/schemes.repository.ts`
- [x] T021 [US2] Implementar reglas DRAFT, instanciación desde plantillas ACTIVE y habilitadas, correspondencia padre-hijo, aislamiento de instancias, ciclos y conflictos de nombre/mapa en `apps/api/src/schemes/schemes.service.ts`
- [x] T022 [US2] Exponer endpoints de schemes y locations con sesión obligatoria y registrar el módulo en `apps/api/src/schemes/schemes.controller.ts`, `apps/api/src/schemes/schemes.module.ts` y `apps/api/src/app.module.ts`
- [x] T023 [US2] Añadir métodos tipados para schemes, locations, movimiento, orden y borrado confirmado en `apps/web/src/api/client.ts`
- [x] T024 [P] [US2] Crear el listado paginado de schemes con estado, habilitación y disponibilidad resumida en `apps/web/src/pages/SchemesPage.tsx`
- [x] T025 [US2] Crear el modelador DRAFT que instancia varias plantillas, repite nodos con identidades propias y reutiliza el editor/confirmación de árbol en `apps/web/src/pages/SchemeEditorPage.tsx`
- [x] T026 [US2] Agregar navegación y rutas protegidas para listado, alta y edición de schemes en `apps/web/src/App.tsx`

**Checkpoint**: US2 puede probarse con plantillas sembradas directamente, aunque la experiencia completa también aprovecha el listado de US1.

---

## Phase 5: User Story 3 - Reordenar y definir el scheme (Priority: P2)

**Goal**: Permitir reordenamiento explícito y congelar un scheme válido como DEFINED con secuencia consecutiva de POSITION utilizables.

**Independent Test**: Crear un árbol de varias ramas, reordenar raíces y hermanos, definirlo y verificar DFS 1..N, exclusión de containers/ramas no utilizables e inmutabilidad estructural posterior.

### Tests for User Story 3

- [x] T027 [US3] Escribir pruebas de integración inicialmente fallidas para permutaciones, rollback de reordenamiento, definición atómica, secuencia DFS, exclusión de ramas no utilizables y bloqueo estructural DEFINED en `apps/api/test/integration/scheme-definition.spec.ts`

### Implementation for User Story 3

- [x] T028 [US3] Implementar reordenamiento y definición transaccionales con bloqueo de filas, validación completa y escritura de leafSequence en `apps/api/src/schemes/schemes.repository.ts`
- [x] T029 [US3] Aplicar transiciones DRAFT→DEFINED, permitir definición deshabilitada, preservar secuencia histórica y registrar resultados estructurados de define en `apps/api/src/schemes/schemes.service.ts`
- [x] T030 [US3] Exponer define y respuestas de error detalladas para orden/árbol inválidos en `apps/api/src/schemes/schemes.controller.ts`
- [x] T031 [US3] Añadir controles de reordenamiento por teclado y arrastre con alternativa accesible y estado de guardado en `apps/web/src/components/TreeEditor.tsx`
- [x] T032 [US3] Añadir validación previa, acción de definir, visualización de leafSequence y modo estructural de solo lectura en `apps/web/src/pages/SchemeEditorPage.tsx`

**Checkpoint**: US3 deja un scheme DEFINED reproducible y auditable por su orden DFS.

---

## Phase 6: User Story 4 - Configurar defaults y settings (Priority: P2)

**Goal**: Guardar defaults de plantilla y overrides de location sin resolver configuración efectiva ni crear una corrida.

**Independent Test**: Guardar un default en POSITION, un setting heredable en CONTAINER y un override en POSITION; modificarlo en DEFINED y eliminar la fila mediante reemplazo con tres valores nulos.

### Tests for User Story 4

- [x] T033 [US4] Escribir pruebas de integración inicialmente fallidas para defaults por rol, capacidad/unidad, ratios, reemplazo completo, inheritToDescendants derivado, edición DEFINED y eliminación idempotente en `apps/api/test/integration/structure-settings.spec.ts`

### Implementation for User Story 4

- [x] T034 [US4] Ampliar DTO, repositorio y servicio de plantillas para defaults válidos solo en POSITION y para eliminación explícita de opcionales en `apps/api/src/structure-templates/structure-templates.dto.ts`, `apps/api/src/structure-templates/structure-templates.repository.ts` y `apps/api/src/structure-templates/structure-templates.service.ts`
- [x] T035 [US4] Implementar reemplazo completo y eliminación de `location_distribution_settings`, auditoría de usuario y derivación por rol en `apps/api/src/schemes/schemes.dto.ts`, `apps/api/src/schemes/schemes.repository.ts` y `apps/api/src/schemes/schemes.service.ts`
- [x] T036 [US4] Exponer PUT/DELETE de settings en DRAFT y DEFINED sin alterar status, árbol ni leafSequence en `apps/api/src/schemes/schemes.controller.ts`
- [x] T037 [P] [US4] Añadir operaciones tipadas de defaults y settings al cliente en `apps/web/src/api/client.ts`
- [x] T038 [P] [US4] Crear el formulario reusable de capacidad con unidad, targetFillRatio, overflow, nulos y herencia derivada en `apps/web/src/components/DistributionSettingsForm.tsx`
- [x] T039 [US4] Integrar edición y limpieza de defaults de POSITION en `apps/web/src/pages/TemplateEditorPage.tsx`
- [x] T040 [US4] Integrar edición y limpieza de settings en DRAFT/DEFINED, sin presentar valores efectivos calculados, en `apps/web/src/pages/SchemeEditorPage.tsx`

**Checkpoint**: US4 persiste intención de configuración y no escribe snapshots ni tablas de corridas.

---

## Phase 7: User Story 5 - Copiar y reorganizar un scheme (Priority: P3)

**Goal**: Copiar un scheme completo a un nuevo DRAFT independiente, preservando linaje y configuración pero limpiando la secuencia.

**Independent Test**: Copiar un DEFINED con settings, comprobar el mapa old→new de locations, modificar la copia y verificar que el origen no cambia y que un fallo forzado revierte todo.

### Tests for User Story 5

- [x] T041 [US5] Escribir pruebas de integración inicialmente fallidas para identidad nueva, basedOnSchemeId, copia de orden/flags/map/settings, leafSequence nula, aislamiento, linaje válido y rollback total en `apps/api/test/integration/structure-copy.spec.ts`

### Implementation for User Story 5

- [x] T042 [US5] Implementar copia transaccional con mapa explícito de IDs padre-hijo y duplicación de settings sin corridas/resultados en `apps/api/src/schemes/schemes.repository.ts`
- [x] T043 [US5] Validar nombre y linaje, fijar DRAFT/enabled, limpiar leafSequence y registrar conteos/tiempo sin payloads sensibles en `apps/api/src/schemes/schemes.service.ts`
- [x] T044 [US5] Exponer POST `/api/schemes/{schemeId}/copy` con contrato tipado y errores de conflicto/linaje en `apps/api/src/schemes/schemes.controller.ts` y `packages/api-types/src/index.ts`
- [x] T045 [US5] Añadir al cliente y al listado la acción de copiar, solicitar nombre/descripción y navegar a la copia DRAFT en `apps/web/src/api/client.ts` y `apps/web/src/pages/SchemesPage.tsx`

**Checkpoint**: US5 produce una propuesta editable sin mutar ni vincular accidentalmente el árbol original.

---

## Phase 8: User Story 6 - Archivar o deshabilitar sin perder historial (Priority: P3)

**Goal**: Separar estado de plantilla, habilitación y disponibilidad para nuevas corridas conservando siempre la estructura existente.

**Independent Test**: Archivar una plantilla usada y confirmar que bloquea instancias nuevas pero conserva locations utilizables; deshabilitarla y verificar indisponibilidad, secuencia histórica visible y recuperación al rehabilitar.

### Tests for User Story 6

- [x] T046 [US6] Escribir pruebas de integración inicialmente fallidas para archive, enable/disable, nodos deshabilitados visibles, bloqueo de instanciación y unavailableReasons reversibles sin pérdida histórica en `apps/api/test/integration/structure-availability.spec.ts`

### Implementation for User Story 6

- [x] T047 [US6] Implementar transición ACTIVE→ARCHIVED, habilitación independiente y protección de instancias existentes en `apps/api/src/structure-templates/structure-templates.repository.ts` y `apps/api/src/structure-templates/structure-templates.service.ts`
- [x] T048 [US6] Derivar usable, availableForNewRun y unavailableReasons desde scheme, plantilla y ruta sin reescribir leafSequence histórica en `apps/api/src/schemes/schemes.repository.ts` y `apps/api/src/schemes/schemes.service.ts`
- [x] T049 [US6] Exponer archive y cambios de enabled, manteniendo administración de schemes deshabilitados, en `apps/api/src/structure-templates/structure-templates.controller.ts` y `apps/api/src/schemes/schemes.controller.ts`
- [x] T050 [P] [US6] Añadir operaciones y tipos de disponibilidad/archivo al cliente en `apps/web/src/api/client.ts`
- [x] T051 [US6] Mostrar acciones de archivar/habilitar, ramas no utilizables y razones de indisponibilidad sin ocultar historial en `apps/web/src/pages/TemplatesPage.tsx`, `apps/web/src/pages/TemplateEditorPage.tsx`, `apps/web/src/pages/SchemesPage.tsx` y `apps/web/src/pages/SchemeEditorPage.tsx`

**Checkpoint**: US6 preserva historial y distingue claramente archivo, habilitación y disponibilidad.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validar garantías que atraviesan varias historias y cerrar la feature completa.

- [x] T052 Consolidar una matriz de seguridad que pruebe 401 UNAUTHENTICATED en cada ruta nueva y ausencia de endpoints públicos de 003 en `apps/api/test/integration/structure-security.spec.ts`
- [x] T053 Consolidar pruebas de atomicidad con fallos inyectados en copia, definición, reordenamiento y borrado, verificando cero cambios parciales en `apps/api/test/integration/structure-atomicity.spec.ts`
- [x] T054 [P] Añadir la prueba opcional `PERF=1` con 1.000 locations sintéticas y presupuesto menor a 2 segundos para cargar, copiar y definir en `apps/api/test/integration/structure-performance.spec.ts`
- [x] T055 [P] Añadir una prueba de límites que confirme cero escrituras en `distribution_runs`, `distribution_position_inputs`, `distribution_anchors`, `distribution_ranges` y `book_placements` en `apps/api/test/integration/structure-boundary.spec.ts`
- [x] T056 Ejecutar y corregir la matriz de `npm run build`, `npm run typecheck`, `npm run lint` y `npm test` desde `package.json`, sin relajar reglas ni usar datos de `docs/dataset.md` o `docs/bjff-collection.csv`
- [x] T057 Ejecutar el escenario manual completo y los casos de fallo de `specs/003-structure-modeling/quickstart.md`, documentando únicamente discrepancias de implementación en ese mismo archivo
- [x] T058 Aplicar Prettier a los archivos modificados de 003 y comprobar que no se introdujeron migraciones ni cambios en `database/01_schema.sql`, `database/02_functions_triggers.sql` o `database/03_views.sql`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; puede empezar inmediatamente.
- **Foundational (Phase 2)**: depende de Setup y bloquea todas las historias.
- **US1 (Phase 3)** y el backend de **US2 (Phase 4)**: pueden comenzar después de Foundational; la UI completa de US2 reutiliza el catálogo de plantillas de US1.
- **US3 (Phase 5)**: depende del árbol concreto de US2.
- **US4 (Phase 6)**: depende de nodos de plantilla de US1 y locations de US2; no depende de US3 porque settings también se editan en DRAFT.
- **US5 (Phase 7)**: depende de US2; el criterio completo con origen DEFINED y settings también requiere US3 y US4.
- **US6 (Phase 8)**: depende de US1 y US2, y puede desarrollarse en paralelo con US3–US5 una vez existan ambos recursos.
- **Polish (Phase 9)**: depende de las historias que se decida incluir en la entrega; para cerrar 003 requiere US1–US6.

### User Story Dependency Graph

```text
Foundation
├── US1 ──┬── US4 ──┐
│         └── US6   │
└── US2 ──┬── US3 ──┼── US5
          ├── US4 ──┘
          └── US6
```

### Within Each User Story

1. Escribir la prueba de la historia y confirmar que falla por la capacidad ausente.
2. Implementar DTOs y persistencia antes de servicio/controlador.
3. Completar backend y verificar la prueba contractual.
4. Implementar cliente y componentes/páginas.
5. Ejecutar el criterio independiente antes de avanzar.

### Parallel Opportunities

- T002 y T003 pueden avanzar en paralelo después de T001 si se acuerdan previamente los nombres de campos.
- T007 puede avanzar en paralelo con T004–T005; T006 comienza cuando T002 haya fijado los códigos compartidos.
- En US1, T013, T014 y T015 trabajan en archivos distintos después de estabilizar el contrato de T008–T012.
- El backend T018–T022 puede avanzar en paralelo con la UI tardía de US1 usando fixtures de plantillas.
- T024 puede avanzar en paralelo con T019–T023 usando los tipos compartidos de T002.
- T037 y T038 pueden avanzar en paralelo; T039 y T040 se integran después.
- T050 puede avanzar en paralelo con T047–T049 una vez fijado el contrato de T046.
- T054 y T055 pueden ejecutarse en paralelo tras completar los flujos backend correspondientes.

---

## Parallel Example: User Story 1

```text
Task T013: cliente tipado de plantillas en apps/web/src/api/client.ts
Task T014: editor y confirmación de árbol en apps/web/src/components/
Task T015: listado de plantillas en apps/web/src/pages/TemplatesPage.tsx
```

## Parallel Example: User Story 4

```text
Task T037: cliente tipado de defaults/settings en apps/web/src/api/client.ts
Task T038: formulario reusable en apps/web/src/components/DistributionSettingsForm.tsx
```

## Parallel Example: User Story 6

```text
Task T047: estados de plantilla en apps/api/src/structure-templates/
Task T048: disponibilidad derivada en apps/api/src/schemes/
Task T050: cliente web de archivo/disponibilidad en apps/web/src/api/client.ts
```

---

## Implementation Strategy

### MVP First (US1)

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational.
3. Completar Phase 3: US1.
4. Validar de forma independiente la creación y activación de una plantilla.
5. Demostrar el MVP antes de incorporar el modelado concreto.

### Recommended Incremental Delivery

1. Setup + Foundational.
2. US1: catálogo de plantillas reutilizables.
3. US2: modelado concreto heterogéneo; primer flujo funcional completo previo a una corrida.
4. US3: definición y secuencia estable.
5. US4: intención de capacidad y llenado.
6. US5: reorganización segura por copia.
7. US6: ciclo de vida y preservación histórica.
8. Polish: seguridad, atomicidad, límites y rendimiento.

### Suggested MVP Scope

El MVP estricto es **US1**. Para un incremento operable de punta a punta antes de una corrida, entregar **US1 + US2 + US3**.

---

## Notes

- `[P]` solo marca trabajo realmente independiente por archivo y dependencia.
- Cada historia conserva un criterio de prueba que puede ejecutarse con fixtures propios.
- No se crean migraciones: 003 usa exclusivamente el esquema existente.
- No se usan `docs/dataset.md` ni `docs/bjff-collection.csv` en pruebas o fixtures.
- Commit después de cada tarea o grupo coherente, manteniendo los cambios de otras personas fuera del staging.
