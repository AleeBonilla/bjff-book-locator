# Plan de implementación: Distribución y búsqueda pública

**Rama de feature**: `004-distribution-search` | **Fecha**: 2026-08-03 | **Spec**:
[spec.md](spec.md)

**Entrada**: especificación de `specs/004-distribution-search/spec.md`

## Resumen

Implementar el ciclo completo de corridas de distribución, desde la resolución de
configuración y el cálculo determinista de cinco estrategias hasta la revisión,
recálculo, comparación, publicación atómica y búsqueda pública aproximada.

La solución amplía el monorepo actual con un módulo NestJS `distribution`, funciones
puras para resolución y algoritmo, contratos en `packages/api-types`, pantallas React
dentro de Esquemas y una ruta pública. Reutiliza las tablas existentes y agrega solo
una columna `revision` mediante migración para detectar conflictos de concurrencia.

## Contexto técnico

**Lenguaje/versión**: TypeScript 5.7, Node.js 20 o superior, SQL PostgreSQL

**Dependencias principales**: NestJS 11, Kysely 0.27, pg 8, class-validator,
`@bjff/classification`, React 19, React Router 7, Vite 6 y Tailwind 4

**Persistencia**: PostgreSQL 15 o superior; desarrollo sobre PostgreSQL 16; migraciones
con node-pg-migrate 7, SQL ordenado y conexión de propietario separada

**Pruebas**: Vitest 3, Supertest 7 y PostgreSQL real en integración serial

**Plataforma objetivo**: aplicación web administrativa y pública; API Node.js y
navegadores modernos en despliegue local o institucional

**Tipo de proyecto**: monorepo web con workspaces `apps/api`, `apps/web` y `packages/*`

**Metas de rendimiento**: calcular 100.000 registros y 1.000 posiciones en menos de 2
minutos; respuesta pública visible en menos de 1 segundo en al menos el 95 % de casos
bajo carga normal

**Restricciones**: orden con colación `C`; un placement por libro y corrida; rangos
continuos semiabiertos; recálculo y publicación atómicos; búsqueda sin sesión y
administración autenticada; no exponer datos privados ni presentar ubicaciones como
confirmadas

**Escala/alcance**: cinco estrategias, hasta 100.000 registros y 1.000 posiciones por
corrida, historial de múltiples corridas por scheme, una distribución activa y una
consulta pública de un código a la vez

## Verificación de la constitución

_Puerta evaluada antes de investigación y nuevamente después del diseño de Phase 1._

Fuente: `.specify/memory/constitution.md` v1.0.0.

- [x] **Spec-first (IV) - PASS**: la especificación 004 y sus aclaraciones definen
      precondiciones, estrategias, fallos, concurrencia, publicación y resultados.
- [x] **Simplicity (II) - PASS**: no se agregan dependencias, workspaces ni tablas; las
      alternativas descartadas quedan en [research.md](research.md).
- [x] **Separation (III) - PASS**: controlador, servicio, repositorio y funciones puras
      conservan separados estructura, configuración, cálculo y resultado publicado.
- [x] **Key-module tests (V) - PASS**: el plan exige pruebas del resolutor, algoritmo,
      transacciones, concurrencia, publicación y búsqueda pública.
- [x] **Security by default (VI) - PASS**: guarda global para administración,
      `@Public()` solo en búsqueda, DTOs validados y consultas parametrizadas.
- [x] **Data evolution (VII) - PASS**: `revision` se agrega con migración hacia adelante
      y la tarea correspondiente debe actualizar `docs/db.md` en el mismo cambio.
- [x] **Replaceable UI (VIII) - PASS**: React consume contratos y no normaliza ni
      calcula; todas las respuestas visibles indican ubicación aproximada.
- [x] **Observability not blocked (IX) - PASS**: cálculos y publicaciones registran
      inicio, fin, duración, conteos y desenlace sin contenido privado.
- [x] **`docs/` is authoritative (X) - PASS**: la decisión 37 registra el mecanismo de
      comandos y concurrencia; el diseño mantiene la terminología acordada.
- [x] **Private material (Restricciones) - PASS**: pruebas y ejemplos usan datos
      sintéticos o `bjff-collection-example.csv`; no se usan los archivos privados.

**Revisión posterior a Phase 1**: PASS. El modelo, contrato y quickstart conservan las
diez puertas; no se identifican desviaciones que requieran seguimiento de complejidad.

## Estructura del proyecto

### Documentación de la feature

```text
specs/004-distribution-search/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- rest-api.md
`-- tasks.md                 # Lo generará speckit-tasks, no este plan
```

### Código fuente

```text
apps/api/src/
|-- app.module.ts
|-- auth/session.guard.ts
|-- common/
|   |-- api-error.ts
|   `-- logger.ts
|-- database/
|   `-- schema.types.ts
`-- distribution/
    |-- distribution.module.ts
    |-- distribution.controller.ts
    |-- public-search.controller.ts
    |-- distribution.dto.ts
    |-- distribution.service.ts
    |-- distribution.repository.ts
    |-- effective-configuration.ts
    |-- distribution-engine.ts
    `-- public-search.service.ts

apps/api/test/
|-- unit/
|   |-- effective-configuration.spec.ts
|   `-- distribution-engine.spec.ts
`-- integration/
    |-- distribution-runs.spec.ts
    |-- distribution-strategies.spec.ts
    |-- distribution-atomicity.spec.ts
    |-- distribution-concurrency.spec.ts
    |-- distribution-publication.spec.ts
    |-- public-search.spec.ts
    |-- distribution-performance.spec.ts
    `-- public-search-performance.spec.ts

apps/web/src/
|-- api/client.ts
|-- App.tsx
|-- components/
|   |-- DistributionRunForm.tsx
|   |-- AnchorEditor.tsx
|   |-- ManualRangeEditor.tsx
|   |-- DistributionWarnings.tsx
|   `-- ApproximateLocation.tsx
`-- pages/
    |-- DistributionRunsPage.tsx
    |-- DistributionRunEditorPage.tsx
    |-- DistributionRunDetailPage.tsx
    `-- PublicSearchPage.tsx

packages/api-types/src/index.ts
package.json
apps/api/package.json
.env.example
database/migrations/[timestamp]_add-distribution-run-revision.sql
docs/db.md
docs/decisiones.md
```

**Decisión de estructura**: conservar los workspaces existentes. El nuevo dominio vive
en un módulo de la API porque ningún otro proceso ejecuta el algoritmo. Los contratos
se comparten en `api-types`; React solo administra formularios y presenta respuestas.
La migración y `docs/db.md` evolucionan juntos durante la implementación.

## Seguimiento de complejidad

No hay violaciones constitucionales que justificar.
