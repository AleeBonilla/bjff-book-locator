---

description: "Task list for Carga administrativa inicial de la colección"
---

# Tasks: Carga administrativa inicial de la colección

**Input**: Design documents from `specs/001-collection-import/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/rest-api.md](contracts/rest-api.md)

**Tests**: Obligatorias en los módulos clave según el principio V de la constitución. En
esta funcionalidad el módulo clave es la normalización y el orden de los códigos de
clasificación (`packages/classification`). Se añaden pruebas de integración a la
importación porque SC-002, SC-003 y SC-007 solo se demuestran contra la base real.

**Organization**: Las tareas se agrupan por historia de usuario para permitir
implementarlas y verificarlas de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias)
- **[Story]**: Historia de usuario a la que pertenece (US1…US7)
- Cada tarea indica su ruta de archivo

## Path Conventions

Monorepo con workspaces de npm, según la decisión de estructura de `plan.md`:

- Backend: `apps/api/`
- Frontend: `apps/web/`
- Paquetes: `packages/classification/`, `packages/api-types/`
- Esquema: `database/` (existente, no se modifica)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dejar el monorepo, las herramientas y la base de datos listos para trabajar

- [X] T001 Crear la raíz del monorepo con workspaces de npm en `package.json` y configuración base de TypeScript en `tsconfig.base.json`
- [X] T002 [P] Definir el servicio de PostgreSQL 16 en `docker-compose.yml`, montando `database/*.sql` en `docker-entrypoint-initdb.d` para que se apliquen en orden
- [X] T003 [P] Documentar las variables de entorno en `.env.example` (conexión, secreto de sesión, límites de tamaño y filas) y confirmar que `.env` está ignorado en `.gitignore`
- [X] T004 [P] Configurar Vitest para todo el monorepo en `vitest.workspace.ts`
- [X] T005 [P] Configurar ESLint y Prettier en `eslint.config.js` y `.prettierrc`
- [X] T006 Inicializar el backend NestJS en `apps/api/` con su `package.json`, `tsconfig.json` y `src/main.ts`
- [X] T007 [P] Inicializar el frontend con Vite, React y Tailwind en `apps/web/` con su `package.json`, `vite.config.ts` y `tailwind.config.ts`
- [X] T008 [P] Inicializar el paquete de clasificación en `packages/classification/` con su `package.json` y `tsconfig.json`, sin dependencias de framework
- [X] T009 [P] Inicializar el paquete de tipos compartidos en `packages/api-types/` con su `package.json` y `tsconfig.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura común que todas las historias necesitan

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta completar esta fase

- [X] T010 Implementar la conexión a PostgreSQL con Kysely y el pool de `pg` en `apps/api/src/database/database.module.ts`
- [X] T011 [P] Declarar los tipos de las tablas `users`, `collection_loads`, `collection_load_errors` y `books` en `apps/api/src/database/schema.types.ts`, conforme a `data-model.md`
- [X] T012 [P] Implementar el ayudante de transacciones en `apps/api/src/database/transaction.ts`
- [X] T013 [P] Implementar la envoltura de errores y el filtro de excepciones en `apps/api/src/common/error-envelope.filter.ts`, con la forma `{ error: { code, message, details } }` de `contracts/rest-api.md`
- [X] T014 [P] Implementar el registro estructurado en `apps/api/src/common/logger.ts`, que emite identificadores, conteos y desenlaces y nunca contenido de filas, credenciales ni identificadores de sesión (FR-043, FR-043c)
- [X] T015 [P] Configurar `node-pg-migrate` y crear el directorio `database/migrations/` con su README explicando que la línea base son los tres scripts de `database/`
- [X] T016 [P] Implementar el arnés de pruebas de integración en `apps/api/test/setup.ts`, que abre una transacción por caso y la revierte al terminar
- [X] T017 [P] Declarar los tipos compartidos del contrato REST en `packages/api-types/src/index.ts` (`Usuario`, `Carga`, `ResumenDeCarga`, `ProblemaDeCarga`, `Registro`, códigos de error)

**Checkpoint**: Infraestructura lista — las historias pueden empezar

---

## Phase 3: User Story 1 - Acceso administrativo autenticado (Priority: P1) 🎯 MVP

**Goal**: Una persona administradora inicia sesión, accede al panel y cierra sesión

**Independent Test**: Iniciar sesión con credenciales válidas, comprobar el acceso,
cerrar sesión y comprobar que el acceso se pierde. No requiere ninguna importación.

### Tests for User Story 1 (REQUIRED for key modules - see constitution V) ⚠️

> **NOTE: Escribir estas pruebas PRIMERO y comprobar que FALLAN antes de implementar**

- [X] T018 [P] [US1] Prueba unitaria del hash y la verificación con `scrypt` en `apps/api/test/unit/password.spec.ts`
- [X] T019 [P] [US1] Pruebas de integración de acceso en `apps/api/test/integration/auth.spec.ts`: credenciales válidas, credenciales inválidas y cuenta deshabilitada con respuesta idéntica, cierre de sesión inmediato y `401` sin sesión (FR-001 a FR-004)

### Implementation for User Story 1

- [X] T020 [US1] Implementar el hash y la verificación de contraseñas con `scrypt` de `node:crypto` en `apps/api/src/auth/password.service.ts`, comparando con `timingSafeEqual` (FR-007)
- [X] T021 [US1] Implementar el almacén de sesiones en memoria del proceso y la configuración de la cookie `httpOnly` en `apps/api/src/auth/session.store.ts` (FR-003)
- [X] T022 [US1] Implementar el servicio de autenticación en `apps/api/src/auth/auth.service.ts`: validar credenciales, exigir `enabled`, actualizar `last_login_at` y devolver el mismo error para credencial inválida y cuenta deshabilitada (FR-002, FR-006)
- [X] T023 [US1] Implementar el controlador en `apps/api/src/auth/auth.controller.ts` con `POST /api/auth/login`, `POST /api/auth/logout` y `GET /api/auth/session` según `contracts/rest-api.md`
- [X] T024 [US1] Implementar la guarda de sesión y aplicarla de forma global en `apps/api/src/auth/session.guard.ts`, dejando exenta únicamente la ruta de inicio de sesión (FR-004, FR-042)
- [X] T025 [US1] Implementar el script de aprovisionamiento de la cuenta ADMIN en `apps/api/scripts/seed-admin.ts`, leyendo credenciales del entorno y sin imprimirlas (FR-005)
- [X] T026 [P] [US1] Implementar la página de acceso y el contexto de sesión en `apps/web/src/pages/LoginPage.tsx` y `apps/web/src/api/session.ts`, con etiquetas asociadas y anuncio de errores

**Checkpoint**: US1 funcional y verificable de forma independiente

---

## Phase 4: User Story 2 - Importar una colección desde un CSV compatible (Priority: P1)

**Goal**: Una persona autenticada importa un CSV y obtiene una carga con estado final y
registros disponibles

**Independent Test**: Importar `bjff-collection-example.csv` y comprobar que la carga
termina en `DONE`, que existen 44 registros y que cada uno conserva su código original y
su número de fila de origen.

### Tests for User Story 2 (REQUIRED for key modules - see constitution V) ⚠️

- [X] T027 [P] [US2] Prueba de integración del recorrido completo en `apps/api/test/integration/import-happy-path.spec.ts`: `DONE`, 44 registros, código original y número de fila conservados (FR-016, FR-030)
- [X] T028 [P] [US2] Pruebas de integración de garantías en `apps/api/test/integration/import-guarantees.spec.ts`: atomicidad ante fallo, cargas independientes, códigos de barras repetidos y archivo de origen no modificado (FR-015, FR-027, FR-028, FR-031)

### Implementation for User Story 2

- [X] T029 [US2] Implementar la lectura del CSV con `csv-parse` en `apps/api/src/collection-loads/csv-reader.service.ts`, con `bom: true`, delimitador `;`, comillas dobles, tolerancia a CRLF y LF y `relax_column_count` (FR-008, FR-008a, FR-008b, FR-009)
- [X] T030 [US2] Implementar la correspondencia de columnas por nombre en `apps/api/src/collection-loads/column-mapping.ts`, con las requeridas y las opcionales de `data-model.md`, ignorando las desconocidas y recortando espacios (FR-010, FR-011, FR-011c, FR-012, FR-014)
- [X] T031 [US2] Implementar el repositorio en `apps/api/src/collection-loads/collection-loads.repository.ts` con inserción de la carga y de los registros por lotes de 1000 filas
- [X] T032 [US2] Implementar el servicio de importación en `apps/api/src/collection-loads/import.service.ts`: crear la carga, procesar en una transacción y cerrar en `DONE` o `ERROR`, garantizando que solo `DONE` expone registros (FR-026, FR-026a, FR-026b, FR-028, FR-028a)
- [X] T033 [US2] Implementar `POST /api/collection-loads` con recepción `multipart/form-data` en `apps/api/src/collection-loads/collection-loads.controller.ts` según `contracts/rest-api.md`
- [X] T034 [US2] Emitir los registros estructurados de inicio y desenlace de cada importación, correlacionados por identificador de carga, desde `apps/api/src/collection-loads/import.service.ts` (FR-043a, FR-043b)
- [X] T035 [P] [US2] Implementar la página de importación con selector de archivo y presentación del resultado en `apps/web/src/pages/ImportPage.tsx`

**Checkpoint**: La colección se importa y es auditable. Los registros aún no tienen clave comparable

---

## Phase 5: User Story 3 - Normalización determinista del código de clasificación (Priority: P2)

**Goal**: Cada código produce una clave comparable estable que permite ordenarlo

**Independent Test**: Importar el archivo de ejemplo dos veces y comparar las claves;
comprobar los pares de equivalencia y de orden de `docs/clasificacion.md`.

### Tests for User Story 3 (REQUIRED for key modules - see constitution V) ⚠️

> **Este es el módulo clave nombrado por el principio V. Las pruebas se escriben primero.**

- [X] T036 [P] [US3] Pruebas unitarias del descomponedor en `packages/classification/test/parse.spec.ts`: separación de prefijo, número DDC, Cutter e indicador de edición
- [X] T037 [P] [US3] Pruebas unitarias de normalización en `packages/classification/test/normalize.spec.ts`: coma decimal a punto, espacios internos, guiones del Cutter, mayúsculas y retiro del indicador de edición solo con Cutter (FR-017)
- [X] T038 [P] [US3] Pruebas unitarias de orden en `packages/classification/test/ordering.spec.ts` con los pares de `docs/clasificacion.md`: `004.0151` antes que `004.1`, `863 S248m` antes que `863 S25m`, sin prefijo antes que con prefijo, y `Cu` igual a `CU` (FR-019, FR-020)
- [X] T039 [P] [US3] Pruebas unitarias de equivalencia y límites en `packages/classification/test/invariants.spec.ts`: misma clave con y sin indicador de edición, clave siempre menor que `~`, determinismo entre ejecuciones y clave nula sin código (FR-021, FR-022, FR-023, FR-024)
- [X] T040 [P] [US3] Pruebas unitarias de motivos de revisión en `packages/classification/test/review-reasons.spec.ts`: valores no canónicos del número DDC, segmento alfabético adicional, Cutter repetido, espacio junto a guion y prefijo no documentado (FR-018, FR-025, FR-025a, FR-025b)

### Implementation for User Story 3

- [X] T041 [US3] Implementar el descomponedor del código en `packages/classification/src/parse.ts`
- [X] T042 [US3] Implementar la construcción de la clave comparable en `packages/classification/src/comparable-key.ts`, ordenable bajo comparación binaria
- [X] T043 [US3] Implementar la detección de motivos de revisión en `packages/classification/src/review-reasons.ts`
- [X] T044 [US3] Exponer la interfaz pública del paquete en `packages/classification/src/index.ts`
- [X] T045 [US3] Integrar el paquete en la importación desde `apps/api/src/collection-loads/import.service.ts`: derivar `comparable_key`, contar las filas sin clave y registrar los problemas de severidad `REVIEW` (FR-024, FR-025)
- [X] T046 [US3] Prueba de integración de SC-002 en `apps/api/test/integration/import-counters.spec.ts`: 44 leídas, 44 importadas, 0 rechazadas, 1 sin clave y 11 marcadas para revisión

**Checkpoint**: Los registros quedan preparados para futuras distribuciones

---

## Phase 6: User Story 4 - Validación del formato antes de incorporar registros (Priority: P2)

**Goal**: Un archivo incompatible se rechaza sin incorporar ningún registro

**Independent Test**: Presentar archivos incompatibles —sin encabezado, sin columnas
requeridas, con otra codificación, por encima de los límites— y comprobar que ninguno
produce registros.

### Tests for User Story 4 (REQUIRED for key modules - see constitution V) ⚠️

- [X] T047 [P] [US4] Pruebas de integración de rechazo en `apps/api/test/integration/import-rejection.spec.ts`, con los códigos y estados de `contracts/rest-api.md`: `NO_FILE`, `FILE_TOO_LARGE`, `TOO_MANY_ROWS`, `INVALID_ENCODING`, `EMPTY_FILE`, `MISSING_HEADER` y `MISSING_REQUIRED_COLUMN`, verificando que no se crea ninguna carga
- [X] T048 [P] [US4] Prueba de integración de fila ilegible en `apps/api/test/integration/import-rejected-rows.spec.ts`: una fila con número de campos distinto se marca `REJECTED` y el resto del archivo continúa (FR-039)

### Implementation for User Story 4

- [X] T049 [US4] Implementar la validación del contrato del archivo previa a crear la carga en `apps/api/src/collection-loads/file-validation.service.ts`: codificación, encabezado, columnas requeridas y archivo vacío (FR-013)
- [X] T050 [US4] Implementar los límites configurables de tamaño y número de filas en `apps/api/src/collection-loads/file-validation.service.ts`, rechazando antes de procesar e indicando el límite excedido (FR-013a, FR-013b)
- [X] T051 [US4] Implementar el tratamiento de la fila ilegible en `apps/api/src/collection-loads/import.service.ts`: marcarla `REJECTED`, registrar el problema y continuar (FR-039)
- [X] T052 [US4] Aplicar `ValidationPipe` con `class-validator` a las entradas del controlador en `apps/api/src/main.ts` (FR-045)
- [X] T053 [P] [US4] Presentar el motivo del rechazo de forma comprensible en `apps/web/src/pages/ImportPage.tsx` (SC-010)

**Checkpoint**: Los archivos incompatibles no llegan a la colección

---

## Phase 7: User Story 5 - Tratamiento de la fila vacía y del pie de control (Priority: P3)

**Goal**: La fila vacía y el pie `TOTAL;n` se excluyen de los registros y el pie sirve de control

**Independent Test**: Importar el archivo de ejemplo y comprobar que produce 44
registros, no 46, y que ninguno corresponde a la fila vacía ni al pie.

### Tests for User Story 5 (REQUIRED for key modules - see constitution V) ⚠️

- [X] T054 [P] [US5] Pruebas de integración en `apps/api/test/integration/import-footer.spec.ts`: 44 registros y no 46, pie ignorado como dato, pie coincidente aceptado, pie discrepante que termina en `ERROR` sin registros disponibles, archivo sin pie procesado con normalidad y fila intermedia vacía ignorada (FR-032, FR-033, FR-034)

### Implementation for User Story 5

- [X] T055 [US5] Implementar la detección de la fila vacía y del pie de control en `apps/api/src/collection-loads/csv-reader.service.ts`, excluyéndolos de las filas de datos (FR-033, FR-035)
- [X] T056 [US5] Implementar la comparación del conteo declarado en el pie con las filas leídas en `apps/api/src/collection-loads/import.service.ts`, terminando en `ERROR` ante discrepancia e informando ambos valores (FR-032, FR-034)

**Checkpoint**: Los contadores parten de un conjunto de filas correcto

---

## Phase 8: User Story 6 - Registro y conteo del resultado de la carga (Priority: P3)

**Goal**: Los cinco contadores explican qué ocurrió con el archivo completo

**Independent Test**: Importar el archivo de ejemplo y comprobar que los contadores son
estables entre ejecuciones y coherentes con las filas leídas.

### Tests for User Story 6 (REQUIRED for key modules - see constitution V) ⚠️

- [X] T057 [P] [US6] Pruebas de integración en `apps/api/test/integration/import-counters-invariant.spec.ts`: los cinco contadores, la invariante `rows_imported + rows_rejected = rows_read` y la estabilidad entre dos importaciones del mismo archivo (FR-036, FR-037, SC-003)

### Implementation for User Story 6

- [X] T058 [US6] Implementar la acumulación y la persistencia de los cinco contadores en `apps/api/src/collection-loads/import.service.ts` (FR-036)
- [X] T059 [US6] Comprobar la invariante de contadores antes de cerrar la carga en `DONE` en `apps/api/src/collection-loads/import.service.ts` (FR-037)
- [X] T060 [US6] Registrar cada problema con número de fila, severidad y motivo comprensible en `apps/api/src/collection-loads/collection-loads.repository.ts` (FR-038)

**Checkpoint**: El resultado de una carga es verificable

---

## Phase 9: User Story 7 - Consulta del resumen y de los problemas de la carga (Priority: P3)

**Goal**: La persona administradora revisa el resultado y localiza cada problema por número de fila

**Independent Test**: Importar el archivo de ejemplo y comprobar que cada problema
listado indica su fila de origen, su severidad y un motivo comprensible.

### Tests for User Story 7 (REQUIRED for key modules - see constitution V) ⚠️

- [X] T061 [P] [US7] Pruebas de integración de consulta en `apps/api/test/integration/collection-loads-query.spec.ts`: listado ordenado por fecha, detalle, problemas ordenados por fila, registros, y `401` sin sesión en todos ellos (FR-040, FR-041, FR-042)

### Implementation for User Story 7

- [X] T062 [US7] Implementar el servicio de consulta con paginación en `apps/api/src/collection-loads/collection-loads.query.service.ts` (FR-040, FR-041)
- [X] T063 [US7] Implementar los recursos `GET /api/collection-loads`, `GET /api/collection-loads/{id}`, `GET /api/collection-loads/{id}/errors` y `GET /api/collection-loads/{id}/books` en `apps/api/src/collection-loads/collection-loads.controller.ts`
- [X] T064 [US7] Restringir la entrega de `rawContent` a la sesión administrativa en `apps/api/src/collection-loads/collection-loads.query.service.ts` (FR-044)
- [X] T065 [P] [US7] Implementar el listado de cargas en `apps/web/src/pages/LoadsPage.tsx`
- [X] T066 [P] [US7] Implementar el detalle de una carga con sus contadores y su tabla de problemas en `apps/web/src/pages/LoadDetailPage.tsx`
- [X] T067 [P] [US7] Implementar la vista de registros de una carga en `apps/web/src/pages/LoadBooksPage.tsx`

**Checkpoint**: Todas las historias funcionan de forma independiente

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cierre transversal y verificación contra la constitución

- [X] T068 [P] Actualizar `README.md` con la estructura del monorepo, los requisitos previos y los comandos de ejecución
- [X] T069 [P] Confirmar que `docs/db.md` no requiere cambios, dado que esta funcionalidad no modifica la persistencia (principio VII)
- [X] T070 [P] Revisión de accesibilidad de las vistas de `apps/web/src/pages/`: etiquetas asociadas, orden y visibilidad del foco, y errores anunciados
- [X] T071 [P] Medir el objetivo de SC-006 con un archivo de 10 000 filas y registrar el resultado en `specs/001-collection-import/quickstart.md`
- [X] T072 [P] Revisar que ninguna respuesta sin sesión ni ningún registro de operación contenga contenido de la colección, recorriendo `apps/api/src/` (FR-043, SC-009)
- [X] T073 [P] Comprobar que `bjff-collection.csv` y `docs/dataset.md` siguen ignorados y que ninguna prueba ni artefacto los referencia
- [ ] T074 Ejecutar la matriz de validación completa de `specs/001-collection-import/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias
- **Foundational (Fase 2)**: depende de Setup — BLOQUEA todas las historias
- **US1 (Fase 3)**: depende de Foundational. Sin dependencias con otras historias
- **US2 (Fase 4)**: depende de Foundational y de US1, porque importar exige sesión
- **US3 (Fase 5)**: depende de Foundational. El paquete es independiente; su integración (T045, T046) requiere US2
- **US4 (Fase 6)**: depende de US2
- **US5 (Fase 7)**: depende de US2
- **US6 (Fase 8)**: depende de US2. Se completa mejor después de US3, US4 y US5, porque son las que producen filas sin clave, rechazadas y marcadas
- **US7 (Fase 9)**: depende de US2 para tener cargas que consultar
- **Polish (Fase 10)**: depende de todas las historias que se vayan a entregar

### Una nota sobre el orden de US2 y US3

Las fases siguen el orden de prioridad de la especificación, así que US2 (P1) precede a
US3 (P2). Es ejecutable: al terminar US2 la colección se importa y es auditable, con
`comparable_key` nula en todos los registros. US3 añade después la derivación de la
clave.

Si se prefiere evitar ese retoque posterior, **US3 puede construirse antes que US2**: el
paquete `packages/classification` no depende de nada más que de la Fase 2, y sus pruebas
(T036 a T040) corren sin base de datos. En ese caso T045 y T046 se ejecutan al terminar
US2. Ambos caminos son válidos; el primero entrega valor antes, el segundo evita tocar
dos veces `import.service.ts`.

### Within Each User Story

- Las pruebas se escriben primero y deben FALLAR antes de implementar
- Descomponedor antes que construcción de clave; repositorio antes que servicio; servicio antes que controlador
- Las vistas del frontend consumen el contrato ya implementado

### Parallel Opportunities

- Fase 1: T002 a T005 y T007 a T009 en paralelo
- Fase 2: T011 a T017 en paralelo tras T010
- US1: T018 y T019 en paralelo; T026 en paralelo con el backend
- US2: T027 y T028 en paralelo; T035 en paralelo con el backend
- US3: T036 a T040 en paralelo, las cinco sin base de datos
- US7: T065 a T067 en paralelo
- Fase 10: T068 a T073 en paralelo

---

## Parallel Example: User Story 3

```bash
# Las cinco suites del módulo clave son independientes entre sí:
Task: "Pruebas del descomponedor en packages/classification/test/parse.spec.ts"
Task: "Pruebas de normalización en packages/classification/test/normalize.spec.ts"
Task: "Pruebas de orden en packages/classification/test/ordering.spec.ts"
Task: "Pruebas de equivalencia y límites en packages/classification/test/invariants.spec.ts"
Task: "Pruebas de motivos de revisión en packages/classification/test/review-reasons.spec.ts"
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Fase 1: Setup
2. Fase 2: Foundational
3. Fase 3: US1 — acceso administrativo
4. Fase 4: US2 — importación
5. **PARAR Y VALIDAR**: se importa la colección y es auditable, con código original y
   número de fila conservados

El MVP no cumple todavía SC-002: la clave comparable llega con US3.

### Entrega incremental

1. Setup y Foundational → base lista
2. US1 → hay panel con acceso
3. US2 → la colección se importa y se conserva
4. US3 → los registros quedan preparados para distribuirse; SC-002 verificable
5. US4 → los archivos incompatibles no entran
6. US5 → contadores sobre un conjunto de filas correcto
7. US6 → el resultado es verificable
8. US7 → el resultado es consultable y los problemas localizables

### Trabajo en paralelo

Con dos personas, tras la Fase 2:

- una toma US1 y luego el frontend de US7;
- la otra toma US3, que no depende de nada y concentra el módulo clave.

US2 requiere US1 terminada, así que conviene que la converjan ambas.

---

## Desviaciones respecto del plan, registradas durante la implementación

Ninguna cambia el comportamiento especificado; son ajustes de herramienta o de nombre.

| Tarea | Lo previsto | Lo implementado | Motivo |
|---|---|---|---|
| T004 | `vitest.workspace.ts` | `vitest.config.ts` con `test.projects` | El archivo de workspace quedó obsoleto en Vitest 3, y `fileParallelism` solo surte efecto en la raíz |
| T007 | `tailwind.config.ts` | `@tailwindcss/vite` sin archivo de configuración | Tailwind 4 se configura desde CSS; no genera ese archivo |
| T016 | Transacción revertida por caso | `TRUNCATE` antes de cada caso, archivos en serie | Las pruebas atraviesan HTTP y la aplicación abre su propia conexión: no puede compartir la transacción del test |
| T020 | `auth/password.service.ts` | `auth/password.ts` | Son funciones puras, sin estado ni inyección |
| T026 | `api/session.ts` | `api/session.tsx` | El contexto contiene JSX |

Añadido fuera de la lista original, por necesidad detectada al ejecutar:

- `docker/initdb/99_app_role.sql`: rol de aplicación con privilegios mínimos, exigido por el principio VI. No pertenece a la línea base de `database/`.
- `packages/classification/tsconfig.build.json` y `apps/api/tsconfig.build.json`: el paquete debía emitir JavaScript para que la API compilada pudiera cargarlo, y la salida de la API quedaba anidada al incluir pruebas y scripts.
- Carga de `.env` con `process.loadEnvFile` en `apps/api/src/config.ts`: sin ella, el flujo documentado en el README no levantaba la aplicación.
- `apps/api/test/integration/performance.spec.ts`: mide SC-006. Se ejecuta solo con `PERF=1`.

## Notes

- `bjff-collection-example.csv` es el archivo de prueba de todos los casos. `bjff-collection.csv` y `docs/dataset.md` son material privado y no se usan en pruebas ni se copian a ningún artefacto
- Las pruebas de integración exigen la base levantada con `docker compose up -d db`
- Cada tarea `[P]` toca archivos distintos de las demás de su grupo
- Confirmar que las pruebas fallan antes de implementar
- Comprometer los cambios por tarea o por grupo lógico
