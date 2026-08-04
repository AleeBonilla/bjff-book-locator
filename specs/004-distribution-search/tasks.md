# Tareas: Distribución y búsqueda pública

**Entrada**: artefactos de diseño en `specs/004-distribution-search/`

**Pruebas**: son obligatorias para el resolutor de configuración, el algoritmo de
distribución, la publicación transaccional y la búsqueda pública según el principio V
de la constitución. Deben escribirse y comprobarse en rojo antes de implementar cada
historia.

**Organización**: las tareas se agrupan por historia de usuario para que cada incremento
pueda implementarse y verificarse por separado.

## Formato

`[ID] [P?] [Historia?] Descripción con ruta de archivo`

- **[P]**: puede ejecutarse en paralelo porque trabaja en archivos distintos y no
  depende de una tarea incompleta.
- **[US1] a [US6]**: historia de usuario correspondiente en `spec.md`.

---

## Phase 1: Preparación

**Propósito**: preparar migraciones, tipos compartidos y el esqueleto del módulo sin
implementar todavía casos de uso.

- [x] T001 [P] Configurar `MIGRATION_DATABASE_URL`, los scripts `migrate` y `migrate:test`, y la migración previa a integración en `.env.example`, `apps/api/package.json` y `package.json`
- [x] T002 [P] Crear la migración reversible de `distribution_runs.revision` y documentar la columna y su rol de propietario en `database/migrations/20260804000000_add-distribution-run-revision.sql` y `docs/db.md`
- [x] T003 Describir las tablas `distribution_runs`, `distribution_position_inputs`, `distribution_anchors`, `distribution_ranges`, `book_placements` y la vista `location_paths` en `apps/api/src/database/schema.types.ts`
- [x] T004 [P] Agregar enums, comandos, respuestas, plantilla de derivación, incidencias, comparaciones, búsquedas y códigos de error de distribución en `packages/api-types/src/index.ts`
- [x] T005 Crear y registrar el esqueleto de distribución en `apps/api/src/distribution/distribution.module.ts`, `apps/api/src/distribution/distribution.controller.ts`, `apps/api/src/distribution/public-search.controller.ts` y `apps/api/src/app.module.ts`
- [x] T006 Ampliar los datos sintéticos de pruebas para crear cargas, schemes, posiciones, snapshots y corridas publicadas sin usar material privado en `apps/api/test/helpers.ts`

---

## Phase 2: Fundamentos compartidos

**Propósito**: establecer validación, persistencia y consultas base que bloquean todas
las historias de usuario.

**CRÍTICO**: ninguna historia comienza hasta completar esta fase.

- [x] T007 Implementar DTOs anidados con whitelist, límites, enums y validación de forma para crear, recalcular, revisar, publicar, comparar y buscar en `apps/api/src/distribution/distribution.dto.ts`
- [x] T008 Implementar mapeos, listado, detalle, consulta de elegibilidad y bloqueo `FOR UPDATE NOWAIT` con traducción de conflictos en `apps/api/src/distribution/distribution.repository.ts`
- [x] T009 Implementar listado, detalle, validaciones comunes de estado, inmutabilidad y `expectedRevision` en `apps/api/src/distribution/distribution.service.ts`
- [x] T010 Exponer `GET /api/distribution-runs` y `GET /api/distribution-runs/:id`, conectar providers y conservar autenticación por defecto en `apps/api/src/distribution/distribution.controller.ts` y `apps/api/src/distribution/distribution.module.ts`

**Checkpoint**: la migración aplica en desarrollo y pruebas, el módulo compila y una
sesión administrativa puede listar y consultar corridas sembradas.

---

## Phase 3: User Story 1 - Crear y calcular una corrida (Priority: P1)

**Objetivo**: seleccionar una carga y un scheme válidos, congelar configuración,
calcular una corrida determinista y consultar su vista previa.

**Prueba independiente**: crear una corrida `HYBRID` sobre datos sintéticos y verificar
estado `DONE`, un snapshot por posición, placements únicos, rangos continuos,
contadores e incidencias; repetir las mismas entradas y obtener el mismo resultado.

### Pruebas para User Story 1

- [x] T011 [P] [US1] Escribir pruebas unitarias en rojo para precedencia por campo, pareja capacidad-unidad, ancestro más cercano, ramas deshabilitadas y trazabilidad de origen en `apps/api/test/unit/effective-configuration.spec.ts`
- [x] T012 [P] [US1] Escribir pruebas unitarias en rojo para agrupamiento estable, reparto híbrido sin anchors, overflow, división consecutiva, rangos semiabiertos y determinismo en `apps/api/test/unit/distribution-engine.spec.ts`
- [x] T013 [P] [US1] Escribir pruebas de integración en rojo para autenticación, elegibilidad, creación `PENDING`, resultado `DONE`, fallo `ERROR`, atomicidad y repetibilidad en `apps/api/test/integration/distribution-runs.spec.ts` y `apps/api/test/integration/distribution-atomicity.spec.ts`

### Implementación para User Story 1

- [x] T014 [P] [US1] Implementar el resolutor puro de configuración efectiva y el objeto `resolution` en `apps/api/src/distribution/effective-configuration.ts`
- [x] T015 [P] [US1] Implementar agrupamiento, segmentación, reparto híbrido base, placements, rangos e incidencias deterministas en `apps/api/src/distribution/distribution-engine.ts`
- [x] T016 [US1] Implementar consultas de libros con colación `C`, creación de cabecera, snapshot, anchors y escritura atómica de resultados y contadores en `apps/api/src/distribution/distribution.repository.ts`
- [x] T017 [US1] Implementar el comando completo de creación y cálculo, transiciones `PENDING/DONE/ERROR`, cambio de scheme a `DISTRIBUTED` y logs seguros de inicio, fin y duración en `apps/api/src/distribution/distribution.service.ts`
- [x] T018 [US1] Exponer `POST /api/distribution-runs` con los estados y errores del contrato en `apps/api/src/distribution/distribution.controller.ts`
- [x] T019 [US1] Agregar listado, detalle y creación de corridas al cliente tipado en `apps/web/src/api/client.ts`
- [x] T020 [P] [US1] Crear el formulario de selección de scheme, carga, estrategia y defaults sin calcular reglas de dominio en `apps/web/src/components/DistributionRunForm.tsx`
- [x] T021 [US1] Crear el historial y acceso a nuevas corridas en `apps/web/src/pages/DistributionRunsPage.tsx`
- [x] T022 [US1] Crear la vista previa inicial con snapshot, rutas, rangos, contadores y estado aproximado en `apps/web/src/pages/DistributionRunDetailPage.tsx`
- [x] T023 [US1] Integrar las rutas de corridas y la pestaña Distribuciones dentro de Esquemas sin agregar una tercera sección principal en `apps/web/src/App.tsx`

**Checkpoint**: US1 funciona por sí sola desde la interfaz administrativa y sus
pruebas demuestran que una corrida válida es reproducible y que un fallo no deja
resultados parciales.

---

## Phase 4: User Story 2 - Publicar una distribución utilizable (Priority: P1)

**Objetivo**: aceptar una vista previa `DONE`, reemplazar atómicamente la versión
pública y activar su scheme con las confirmaciones necesarias.

**Prueba independiente**: sembrar dos corridas `DONE`, publicar una mientras otra está
activa y verificar que nunca existen dos schemes activos ni dos corridas publicadas por
scheme; una corrida con no asignados exige confirmación adicional.

### Pruebas para User Story 2

- [x] T024 [P] [US2] Escribir pruebas de integración en rojo para precondiciones, confirmación de no asignados, rollback, carreras de publicación, revisiones y visibilidad atómica en `apps/api/test/integration/distribution-publication.spec.ts`

### Implementación para User Story 2

- [x] T025 [US2] Implementar la transacción que bloquea corrida y schemes, despublica, publica, activa e incrementa las revisiones afectadas en `apps/api/src/distribution/distribution.repository.ts`
- [x] T026 [US2] Implementar validación de aceptación, advertencias no bloqueantes, confirmación adicional y logs de publicación en `apps/api/src/distribution/distribution.service.ts`
- [x] T027 [US2] Exponer `POST /api/distribution-runs/:id/publish` y agregarlo al cliente tipado en `apps/api/src/distribution/distribution.controller.ts` y `apps/web/src/api/client.ts`
- [x] T028 [P] [US2] Crear el resumen reutilizable de no asignados, posiciones vacías, sobrecargas y claves divididas en `apps/web/src/components/DistributionWarnings.tsx`
- [x] T029 [US2] Integrar aceptación de vista previa, confirmación separada de no asignados y resultado de publicación en `apps/web/src/pages/DistributionRunDetailPage.tsx`

**Checkpoint**: US2 puede verificarse con corridas sembradas sin depender de la
búsqueda pública, y todo cambio de versión se confirma o revierte completo.

---

## Phase 5: User Story 3 - Buscar una ubicación aproximada (Priority: P1)

**Objetivo**: permitir una consulta sin sesión que use exclusivamente el scheme activo
y su corrida publicada, con precedencia de coincidencia exacta sobre rango.

**Prueba independiente**: crear y publicar una distribución de US1 y US2, y consultar
un código exacto con varias posiciones, otro cubierto solo por rango, entradas no
ubicables, una coincidencia exacta sin placements y ausencia de distribución; ninguna
respuesta expone datos administrativos.

### Pruebas para User Story 3

- [x] T030 [P] [US3] Escribir pruebas unitarias en rojo para normalización, precedencia exacta, deduplicación de rutas, fallback por rango solo sin coincidencia exacta y respuesta sin ubicación para coincidencias exactas sin placements en `apps/api/test/unit/public-search.spec.ts`
- [x] T031 [P] [US3] Escribir pruebas de integración en rojo para acceso anónimo, aislamiento de la corrida publicada, cobertura desde `''` hasta `~`, frontera semiabierta, múltiples posiciones, coincidencia exacta sin placements y ausencia de filtraciones en `apps/api/test/integration/public-search.spec.ts`

### Implementación para User Story 3

- [x] T032 [US3] Implementar consultas exactas y por rango limitadas a scheme activo, corrida publicada y carga vinculada en `apps/api/src/distribution/distribution.repository.ts`
- [x] T033 [US3] Implementar normalización compartida, resolución exacta o por rango y respuesta siempre aproximada en `apps/api/src/distribution/public-search.service.ts`
- [x] T034 [US3] Exponer solamente `POST /api/public/search` con `@Public()` y conectar el servicio sin abrir rutas administrativas en `apps/api/src/distribution/public-search.controller.ts` y `apps/api/src/distribution/distribution.module.ts`
- [x] T035 [P] [US3] Agregar el llamado público y crear el formulario accesible y la presentación reutilizable de ubicación aproximada con estados encontrado y no encontrado en `apps/web/src/api/client.ts`, `apps/web/src/pages/PublicSearchPage.tsx` y `apps/web/src/components/ApproximateLocation.tsx`
- [x] T036 [US3] Renderizar `/buscar` antes del control de sesión, dirigir `/` a la búsqueda y conservar `/acceso` para administración en `apps/web/src/App.tsx`

**Checkpoint**: US3 se prueba sin iniciar sesión y siempre devuelve una ruta aproximada
de una sola versión o un mensaje seguro sin ubicación.

---

## Phase 6: User Story 4 - Revisar y recalcular un borrador (Priority: P2)

**Objetivo**: revisar incidencias, editar entradas permitidas y reemplazar una vista
previa no publicada sin perder el último resultado válido ante fallos o concurrencia.

**Prueba independiente**: modificar un anchor, recalcular con la revisión vigente y
comprobar el reemplazo completo; provocar un fallo y un conflicto concurrente y
verificar que snapshot, resultados, estado y revisión anteriores permanecen intactos.

### Pruebas para User Story 4

- [x] T037 [P] [US4] Escribir pruebas unitarias en rojo para derivar posiciones vacías, sobrecargas, claves divididas y no asignados desde snapshot y placements en `apps/api/test/unit/distribution-incidents.spec.ts`
- [x] T038 [P] [US4] Escribir pruebas de integración en rojo para recálculo, reconstrucción, rollback, reintento `ERROR` exitoso y fallido con incremento de revisión y cero resultados parciales, `RUN_BUSY`, `RUN_VERSION_CONFLICT`, revisión opcional y búsqueda de prueba en `apps/api/test/integration/distribution-concurrency.spec.ts` y `apps/api/test/integration/distribution-review.spec.ts`

### Implementación para User Story 4

- [x] T039 [US4] Implementar reemplazo transaccional con `FOR UPDATE NOWAIT`, control de revisión, reconstrucción de snapshot, revisión de rangos y rollback total en `apps/api/src/distribution/distribution.repository.ts`
- [x] T040 [US4] Implementar recálculo de `DONE` con rollback y reintento de `ERROR` conservando identidad, actualizando diagnóstico e incrementando revisión en cada intento terminado, además de inmutabilidad publicada, incidencias derivadas, revisión opcional y búsqueda de prueba en `apps/api/src/distribution/distribution.service.ts`
- [x] T041 [US4] Exponer recálculo, revisión de rango y búsqueda de prueba, y agregar sus comandos al cliente en `apps/api/src/distribution/distribution.controller.ts` y `apps/web/src/api/client.ts`
- [x] T042 [P] [US4] Crear el editor de anchors por posición y código legible, sin editar claves normalizadas, en `apps/web/src/components/AnchorEditor.tsx`
- [x] T043 [US4] Crear la pantalla de edición y recálculo con conservación local del formulario y recuperación ante conflicto en `apps/web/src/pages/DistributionRunEditorPage.tsx`
- [x] T044 [US4] Integrar incidencias, notas de revisión y búsqueda de prueba en `apps/web/src/pages/DistributionRunDetailPage.tsx`

**Checkpoint**: US4 sustituye una vista previa solo si el comando completo termina bien;
ninguna pantalla vieja puede sobrescribir la revisión vigente.

---

## Phase 7: User Story 5 - Aplicar estrategias y límites conocidos (Priority: P2)

**Objetivo**: completar los contratos de `CAPACITY`, `WEIGHTED`, `ANCHORED`, `HYBRID`
y `MANUAL`, solicitando y aceptando solo entradas compatibles.

**Prueba independiente**: calcular una corrida mínima válida y rechazar una combinación
prohibida para cada estrategia, incluyendo redondeo hacia abajo, anchors inamovibles y
cobertura manual completa.

### Pruebas para User Story 5

- [x] T045 [P] [US5] Ampliar las pruebas unitarias en rojo para los cinco contratos, redondeo con `Math.floor`, pesos relativos, anchors completos o parciales y cobertura manual en `apps/api/test/unit/distribution-engine.spec.ts`
- [x] T046 [P] [US5] Escribir pruebas de integración en rojo para entradas requeridas y prohibidas, normalización de anchors y rangos manuales, fuentes de resultados y errores localizados en `apps/api/test/integration/distribution-strategies.spec.ts`

### Implementación para User Story 5

- [x] T047 [US5] Completar validadores y algoritmos `CAPACITY`, `WEIGHTED`, `ANCHORED`, `HYBRID` y `MANUAL` en `apps/api/src/distribution/distribution-engine.ts`
- [x] T048 [US5] Normalizar anchors y rangos manuales con `@bjff/classification`, rechazar entradas incompatibles antes de persistir y localizar el elemento corregible en `apps/api/src/distribution/distribution.service.ts`
- [x] T049 [P] [US5] Crear el editor de cobertura manual continua por rutas y códigos legibles en `apps/web/src/components/ManualRangeEditor.tsx`
- [x] T050 [US5] Adaptar campos, ayuda y validación de forma del formulario a la estrategia seleccionada sin duplicar reglas del backend en `apps/web/src/components/DistributionRunForm.tsx`
- [x] T051 [US5] Integrar anchors, rangos manuales y errores por entrada en la pantalla de creación y edición en `apps/web/src/pages/DistributionRunEditorPage.tsx`

**Checkpoint**: US5 demuestra los cinco contratos de estrategia de extremo a extremo y
ninguna entrada incompatible se ignora silenciosamente.

---

## Phase 8: User Story 6 - Derivar, comparar y restaurar versiones (Priority: P3)

**Objetivo**: crear corridas independientes con linaje, comparar sus resultados y
volver a publicar una versión anterior sin reescribirla.

**Prueba independiente**: derivar desde una corrida publicada usando otra carga,
comparar contadores, rangos e incidencias y alternar la publicación; snapshots,
placements y rangos de ambas versiones permanecen distintos e intactos.

### Pruebas para User Story 6

- [x] T052 [P] [US6] Escribir pruebas de integración en rojo para plantilla de derivación calculada por backend, linaje del mismo scheme, nueva carga, copia solo de entradas editables, exclusión de resultados, comparación y restauración sin mutar resultados en `apps/api/test/integration/distribution-versioning.spec.ts`

### Implementación para User Story 6

- [x] T053 [US6] Implementar consultas para la plantilla de derivación y diferencias de contadores, rangos, asignaciones e incidencias, con validación de linaje, en `apps/api/src/distribution/distribution.repository.ts`
- [x] T054 [US6] Implementar la plantilla de derivación con configuración vigente y solo entradas editables, creación con identidad propia y comparación contra base u otra corrida del mismo scheme en `apps/api/src/distribution/distribution.service.ts`
- [x] T055 [US6] Exponer `GET /api/distribution-runs/:id/derivation-template` y `GET /api/distribution-runs/:id/comparison`, y agregar ambos contratos al cliente en `apps/api/src/distribution/distribution.controller.ts` y `apps/web/src/api/client.ts`
- [x] T056 [P] [US6] Implementar la acción de crear derivada consumiendo la plantilla del backend, con estrategia, defaults, anchors o rangos manuales editables y carga seleccionable, sin reproducir reglas de copia en React, en `apps/web/src/pages/DistributionRunEditorPage.tsx`
- [x] T057 [US6] Mostrar diferencias de contadores, fronteras, rutas e incidencias contra la base en `apps/web/src/pages/DistributionRunDetailPage.tsx`
- [x] T058 [US6] Integrar historial de linaje, comparación y restauración mediante el mismo comando de publicación en `apps/web/src/pages/DistributionRunsPage.tsx`

**Checkpoint**: US6 conserva todo el historial y restaura una versión anterior mediante
selección transaccional, nunca mediante copia o modificación de resultados.

---

## Phase 9: Pulido y aspectos transversales

**Propósito**: verificar rendimiento, seguridad, observabilidad, documentación y
coherencia del incremento completo.

- [x] T059 [P] Crear pruebas sintéticas que midan una corrida de 100.000 registros y 1.000 posiciones en menos de 2 minutos y al menos el 95 % de búsquedas públicas en menos de 1 segundo bajo la carga operativa definida, sin datos privados, en `apps/api/test/integration/distribution-performance.spec.ts` y `apps/api/test/integration/public-search-performance.spec.ts`
- [x] T060 [P] Probar que todas las rutas administrativas exigen sesión, que solo la búsqueda es pública y que las respuestas no filtran borradores ni datos administrativos en `apps/api/test/integration/distribution-security.spec.ts`
- [x] T061 Endurecer el saneamiento de campos de códigos, claves y fronteras y probar logs de cálculo y publicación sin material privado en `apps/api/src/common/logger.ts` y `apps/api/test/unit/logger.spec.ts`
- [x] T062 [P] Revisar que la implementación final siga `docs/flujo.md`, `docs/db.md`, `docs/decisiones.md` y `specs/004-distribution-search/contracts/rest-api.md`, actualizando solo divergencias reales en esos archivos
- [x] T063 Ejecutar typecheck, lint, formato, pruebas y build, y corregir fallos de 004 en `apps/api/src/distribution/`, `apps/web/src/`, `packages/api-types/src/index.ts` y `apps/api/test/`
- [x] T064 Ejecutar todos los escenarios manuales, cronometrar que crear, calcular, revisar y publicar una corrida válida tome menos de 10 minutos, y completar la revisión de seguridad de `specs/004-distribution-search/quickstart.md`, incluida la interfaz sin flechas tipográficas, guiones largos o logotipos institucionales

---

## Dependencias y orden de ejecución

### Dependencias por fase

- **Phase 1, Preparación**: inicia inmediatamente.
- **Phase 2, Fundamentos**: depende de Phase 1 y bloquea todas las historias.
- **US1**: depende de Fundamentos y establece el cálculo base.
- **US2**: depende de US1 para publicar una corrida calculada.
- **US3**: depende de US1 para reutilizar el repositorio y el modelo de resultados de una
  corrida calculada. Sus pruebas pueden sembrar la publicación sin esperar la interfaz
  de US2.
- **US4**: depende de US1 para recalcular una vista previa existente.
- **US5**: depende del motor base de US1 y puede avanzar en paralelo con US4.
- **US6**: depende de US1, US2 y US4 para derivar, comparar y restaurar el ciclo
  completo.
- **Pulido**: depende de todas las historias incluidas en el incremento.

### Grafo de historias

```text
Fundamentos
|-- US1 Crear y calcular
|   |-- US2 Publicar
|   |-- US3 Búsqueda pública
|   |-- US4 Revisar y recalcular
|   |   `-- US6 Derivar, comparar y restaurar
|   `-- US5 Estrategias

US2 también precede a US6.
```

### Orden dentro de cada historia

1. Escribir las pruebas indicadas y comprobar que fallan por la capacidad ausente.
2. Implementar funciones puras y persistencia.
3. Implementar servicio y contrato HTTP.
4. Integrar el cliente y la interfaz.
5. Ejecutar la prueba independiente antes de continuar.

## Oportunidades de paralelización

- T001, T002 y T004 trabajan en archivos separados y pueden avanzar en paralelo.
- T011, T012 y T013 pueden escribirse en paralelo antes de US1; T014 y T015 también
  pueden implementarse en paralelo después de sus pruebas.
- Las pruebas de US3 marcadas [P] pueden prepararse en paralelo una vez terminado US1,
  pero su implementación se coordina con US2 porque ambas modifican persistencia de
  distribución.
- Después de US1, US4 y US5 pueden desarrollarse en paralelo.
- Las tareas de pruebas marcadas [P] dentro de cada historia trabajan en archivos
  distintos.
- T059, T060 y T062 pueden avanzar en paralelo al cierre, antes de ejecutar las puertas
  completas T063 y T064.

## Ejemplos de ejecución paralela

### User Story 1

```text
T011: pruebas del resolutor efectivo
T012: pruebas del motor determinista
T013: pruebas HTTP y de atomicidad

Luego:
T014: resolutor efectivo
T015: motor híbrido base
```

### User Story 2

```text
T024: pruebas transaccionales de publicación
T028: componente visual de advertencias
```

### User Story 3

```text
T030: pruebas unitarias de resolución pública
T031: pruebas HTTP sin sesión
```

### User Story 4

```text
T037: pruebas de incidencias derivadas
T038: pruebas de recálculo, locks y revisiones
```

### User Story 5

```text
T045: matriz unitaria de estrategias
T046: contratos HTTP de estrategias
```

### User Story 6

```text
T052: pruebas de linaje y restauración
T056: interfaz de precarga para derivación
```

## Estrategia de implementación

### MVP técnico: User Story 1

1. Completar Preparación.
2. Completar Fundamentos.
3. Implementar US1.
4. Detenerse y verificar creación, cálculo, determinismo y atomicidad.

Este MVP valida el riesgo técnico principal, pero todavía no ofrece valor público.

### Primer incremento publicable

1. Completar US1 para calcular.
2. Completar US2 para publicar.
3. Completar US3 para buscar sin sesión.
4. Ejecutar pruebas de seguridad y el flujo público del quickstart.

### Entrega incremental

1. **US1**: cálculo reproducible.
2. **US2**: publicación atómica.
3. **US3**: utilidad pública completa.
4. **US4 y US5**: revisión y flexibilidad operativa.
5. **US6**: mantenimiento histórico y restauración.
6. **Pulido**: rendimiento, seguridad, documentación y verificación final.

## Notas

- Una tarea [P] no implica que deba ejecutarse en paralelo, solo que puede hacerlo sin
  conflicto de archivo o dependencia.
- Los datos de pruebas deben ser sintéticos o provenir de
  `bjff-collection-example.csv`.
- Ninguna tarea debe leer, registrar o incluir `bjff-collection.csv` ni
  `docs/dataset.md`.
- Los componentes React presentan contratos; no normalizan códigos ni calculan
  ubicaciones.
- Conviene commitear por tarea o grupo lógico y ejecutar el checkpoint de cada historia
  antes de continuar.
