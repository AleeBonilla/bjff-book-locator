# Implementation Plan: Carga administrativa inicial de la colección

**Branch**: `001-collection-import` | **Date**: 2026-07-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-collection-import/spec.md`

## Summary

Permitir que una persona administradora autenticada importe la colección desde un CSV
compatible y obtenga un resultado verificable, con los registros válidos preparados
para futuras distribuciones.

Enfoque técnico: monorepo TypeScript con workspaces de npm. Backend NestJS sobre
PostgreSQL, consumiendo el esquema ya existente en `database/` sin modificarlo.
Frontend React con Vite y Tailwind. La normalización de códigos de clasificación vive
en un paquete propio, sin dependencias de framework, porque es el módulo clave del que
depende todo el orden del sistema y porque la búsqueda pública deberá usar exactamente
la misma función. La importación se procesa de forma síncrona y atómica.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 20 LTS

**Primary Dependencies**: NestJS (API REST), React + Vite (frontend), Tailwind CSS,
Kysely + `pg` (acceso a datos), `csv-parse` (lectura del archivo), `class-validator`
(validación de entrada)

**Storage**: PostgreSQL 16 en Docker para desarrollo. Esquema existente en
`database/*.sql`, aplicado como línea base. Migraciones posteriores con
`node-pg-migrate`; esta funcionalidad no requiere ninguna.

**Testing**: Vitest. Unitarias sin base de datos para la normalización; de integración
contra PostgreSQL real para la importación, con reversión por caso.

**Target Platform**: servicio web en Linux; navegadores modernos de escritorio

**Project Type**: aplicación web con frontend y backend desacoplados en un monorepo

**Performance Goals**: resultado completo de una importación de 10 000 filas en menos
de 30 segundos (SC-006); confirmación de acceso o rechazo del archivo de forma
inmediata

**Constraints**: la importación es síncrona y atómica; el esquema SQL es fuente de
verdad y no se modifica en esta funcionalidad; ningún dato de `bjff-collection.csv` ni
de `docs/dataset.md` puede llegar al repositorio, a los registros ni a los artefactos
generados; el orden de las claves debe ser determinista bajo `COLLATE "C"`

**Scale/Scope**: colección del orden de 10 000 registros; unas pocas cuentas
administrativas; 7 historias de usuario, 61 requisitos funcionales, 12 criterios de
éxito

Todas las incógnitas quedaron resueltas en [research.md](research.md). No hay
`NEEDS CLARIFICATION` pendientes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Source: `.specify/memory/constitution.md` (v1.0.0). Evaluado antes de la investigación
y de nuevo tras el diseño de la Fase 1. Resultado idéntico en ambas pasadas.

- [x] **Spec-first (IV)**: PASS — especificación aprobada y aclarada; 0 marcadores
      pendientes. Los puntos no resueltos están registrados como supuestos explícitos.
- [x] **Simplicity (II)**: PASS con justificación — ver Complexity Tracking. Se
      descartaron ORM, almacén de sesiones persistente, `COPY FROM` y orquestador de
      monorepo, cada uno con su alternativa más simple registrada en research.md.
- [x] **Separation (III)**: PASS — la normalización no depende del framework y vive en
      su propio paquete; las reglas de dominio están en servicios, no en controladores
      ni en la interfaz; la persistencia no añade reglas de negocio sobre las que ya
      protege el esquema.
- [x] **Key-module tests (V)**: PASS — `packages/classification` concentra la
      normalización y el orden, con pruebas unitarias sobre los pares de
      `docs/clasificacion.md`; la importación tiene pruebas de integración con
      contadores verificados contra SC-002.
- [x] **Security by default (VI)**: PASS — usuario de base de datos con privilegios
      mínimos; secretos en `.env` no versionado; validación en el servidor con
      `ValidationPipe` (FR-045); consultas parametrizadas por Kysely; límites de tamaño
      y filas antes de procesar (FR-013a); `scrypt` para contraseñas (FR-007).
- [x] **Data evolution (VII)**: PASS — línea base intacta, `node-pg-migrate` preparado
      para el primer cambio real. Esta funcionalidad no altera la persistencia, así que
      `docs/db.md` no requiere cambios.
- [x] **Replaceable UI (VIII)**: PASS — la interfaz no normaliza códigos ni calcula
      nada; consume el contrato de [contracts/rest-api.md](contracts/rest-api.md).
- [x] **Observability not blocked (IX)**: PASS — registro estructurado de inicio y
      desenlace de cada importación, correlacionado por identificador de carga
      (FR-043a, FR-043b), sin contenido de filas ni credenciales (FR-043c).
- [x] **`docs/` is authoritative (X)**: PASS — el plan no introduce reglas de dominio
      nuevas; la terminología y el orden determinista provienen de
      `docs/clasificacion.md` y `docs/flujo.md`.
- [x] **Private material (Restricciones)**: PASS — `bjff-collection.csv` y
      `docs/dataset.md` siguen excluidos; las pruebas y los ejemplos usan
      `bjff-collection-example.csv`; `rawContent` queda tras la sesión (FR-044).

## Project Structure

### Documentation (this feature)

```text
specs/001-collection-import/
├── spec.md              # Especificación (entrada)
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones técnicas y alternativas
├── data-model.md        # Fase 1: uso del esquema existente
├── contracts/
│   └── rest-api.md      # Fase 1: contrato REST
├── quickstart.md        # Fase 1: puesta en marcha y validación
├── checklists/
│   └── requirements.md  # Calidad de la especificación
└── tasks.md             # Fase 2: lo genera /speckit-tasks
```

### Source Code (repository root)

```text
apps/
├── api/                      # NestJS
│   ├── src/
│   │   ├── auth/             # sesión, guardas, hash de contraseñas
│   │   ├── collection-loads/ # importación, contadores, consulta
│   │   ├── database/         # conexión, tipos de tablas, transacciones
│   │   └── common/           # envoltura de errores, registro estructurado
│   ├── scripts/              # aprovisionamiento de la cuenta ADMIN
│   └── test/                 # integración contra PostgreSQL
└── web/                      # React + Vite + Tailwind
    └── src/
        ├── pages/            # acceso, listado de cargas, detalle
        ├── components/       # formulario, tabla, selector de archivo
        └── api/              # cliente del contrato REST

packages/
├── classification/           # normalización y orden. Sin dependencias de framework
└── api-types/                # tipos compartidos del contrato REST

database/                     # línea base existente
└── migrations/               # vacío en esta funcionalidad

docker-compose.yml            # PostgreSQL 16 con la línea base al inicializar
```

**Structure Decision**: monorepo con workspaces de npm y cuatro paquetes.
`apps/api` y `apps/web` materializan el desacoplamiento pedido.
`packages/classification` existe porque la normalización es el módulo clave del
principio V y porque la búsqueda pública futura debe usar la misma función: separarla
convierte esa garantía en algo estructural en vez de una convención.
`packages/api-types` evita que el contrato se desincronice entre frontend y backend.
`database/` permanece donde está, como fuente de verdad del esquema.

## Complexity Tracking

> Desviaciones y dependencias que el principio II obliga a justificar.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Cuatro workspaces en vez de un único proyecto | El encargo pide un monorepo desacoplado; además el principio V exige que la normalización sea probable de forma aislada, y la futura búsqueda pública debe reutilizar exactamente esa función | Una sola aplicación obligaría a duplicar la normalización cuando llegue la búsqueda, y duplicarla rompe la garantía de orden determinista de FR-023 |
| Kysely como dependencia de acceso a datos | Da seguridad de tipos y parametrización en las consultas del importador, que es el módulo clave, sin apropiarse del esquema | `pg` a secas deja las consultas del módulo clave sin verificación en compilación; un ORM entraría en conflicto con los principios VII y X al querer poseer el esquema |
| Sesión en memoria del proceso | FR-003 exige invalidación inmediata, que un token autocontenido no da sin lista de revocación | Una tabla de sesiones obligaría a una migración y a tocar `docs/db.md` por un beneficio —sobrevivir al reinicio y escalar a varias instancias— que esta versión no necesita. Queda registrado como límite conocido |

## Decisiones de diseño tomadas en esta fase

Dos puntos que la especificación dejaba con latitud y que el contrato tuvo que cerrar:

**Rechazo del archivo frente a carga en `ERROR`.** El contrato del archivo
—codificación, encabezado, columnas requeridas y límites— se valida antes de crear la
carga, así que un archivo incompatible responde `4xx` y no deja rastro en el historial.
`ERROR` queda reservado para fallos durante el procesamiento, como la discrepancia del
pie de FR-032. Evita que seleccionar el archivo equivocado ensucie el historial.

> La justificación original apelaba a que FR-041a impedía limpiar ese historial.
> [`002-load-management`](../002-load-management/spec.md) derogó esa regla y ya permite
> eliminar cargas, así que el argumento pesa menos. La decisión se mantiene igual: es
> preferible no crear una carga por cada archivo equivocado a tener que borrarla luego.

**Aplicación de la línea base completa.** Se crean todas las tablas del esquema, no
solo las cuatro que esta funcionalidad usa. Los tres scripts se referencian entre sí
mediante llaves foráneas y triggers; recortarlos produciría un esquema distinto del
documentado, contra el principio X.
