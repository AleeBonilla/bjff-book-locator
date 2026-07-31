# Implementation Plan: Modelado de la estructura física

**Branch**: 003-structure-modeling | **Date**: 2026-07-31 | **Spec**:
[spec.md](spec.md)

**Input**: Feature specification from specs/003-structure-modeling/spec.md

## Summary

Implementar la fase administrativa previa a una corrida: crear y activar plantillas,
modelar schemes heterogéneos, ordenar locations, derivar leaf_sequence, mantener
settings, copiar versiones y retirar elementos sin perder historial.

El enfoque extiende el monorepo y el contrato REST existentes. NestJS concentra las
reglas de árbol y las transacciones; Kysely usa sin modificar la forma de
database/01_schema.sql; React presenta editores administrativos y
packages/api-types comparte el contrato. No se crean corridas ni se resuelve
configuración efectiva.

## Technical Context

**Language/Version**: TypeScript 5.7 sobre Node.js 20 o superior

**Primary Dependencies**: NestJS 11, Kysely 0.27 y pg 8 en la API; React 19,
React Router 7, Vite 6 y Tailwind CSS 4 en el panel; class-validator para entrada.
No se agregan dependencias.

**Storage**: PostgreSQL 16 en Docker para desarrollo, compatible con el mínimo 15.
Se reutiliza la línea base database/01_schema.sql y sus triggers; 003 no requiere
migraciones.

**Testing**: Vitest 3 y Supertest 7. Unitarias para algoritmos puros; integración en
serie contra PostgreSQL real mediante bjff_test y limpieza entre casos.

**Target Platform**: servicio web en Linux y navegadores modernos de escritorio

**Project Type**: aplicación web con frontend y backend desacoplados dentro de un
monorepo de workspaces npm

**Performance Goals**: completar el escenario de veinte posiciones en menos de
quince minutos; cargar, copiar o definir un árbol sintético de 1 000 locations en
menos de 2 segundos en integración local

**Constraints**: todas las operaciones administrativas exigen sesión; reglas de
dominio en servicios; escrituras parametrizadas; copias, definiciones, órdenes y
borrados atómicos; no modificar leaf_sequence desde el cliente; no usar ni registrar
material privado; no crear entidades de distribución

**Scale/Scope**: pocas cuentas administrativas y baja concurrencia; decenas de
plantillas; referencia de hasta 1 000 locations por scheme sin límite funcional
artificial; seis historias, 52 requisitos y 11 criterios de éxito

Todas las decisiones técnicas están resueltas en [research.md](research.md). No quedan
incógnitas técnicas pendientes.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

Source: .specify/memory/constitution.md v1.0.0. El resultado fue el mismo antes y
después del diseño.

- [x] **Spec-first (IV)**: PASS — 003 existe, pasó clarify con cinco respuestas y no
      tiene marcadores pendientes. La invocación explícita de plan autoriza avanzar;
      PA-001 conserva aparte la duda sobre el vocabulario formal de estados.
- [x] **Simplicity (II)**: PASS — se reutilizan módulos, dependencias y tablas. No se
      agrega ORM, workspace, biblioteca de componentes, drag-and-drop ni migración.
      research.md registra las alternativas descartadas.
- [x] **Separation (III)**: PASS — plantillas, estructura concreta, settings y
      distribución conservan ciclos separados. React no calcula disponibilidad,
      jerarquía ni secuencia; los controladores delegan en servicios.
- [x] **Key-module tests (V)**: PASS — 003 no modifica normalización, algoritmo de
      distribución, resolución efectiva, publicación ni búsqueda. Aun así, DFS,
      disponibilidad y operaciones transaccionales reciben pruebas automatizadas.
- [x] **Security by default (VI)**: PASS — la guarda global protege rutas nuevas,
      class-validator y el servicio validan entrada, Kysely parametriza consultas y el
      rol de aplicación conserva privilegios mínimos.
- [x] **Data evolution (VII)**: PASS — la forma de persistencia ya satisface 003. No
      se edita la línea base ni se crea migración; schema.types.ts solo describe tablas
      existentes.
- [x] **Replaceable UI (VIII)**: PASS — el contrato está en
      contracts/rest-api.md y packages/api-types; toda regla reside en la API.
- [x] **Observability not blocked (IX)**: PASS — copia y definición registran inicio,
      fin, resultado, schemeId y cantidades, nunca nombres completos de árboles,
      settings sensibles, credenciales ni contenido privado.
- [x] **docs/ is authoritative (X)**: PASS — el diseño deriva de docs/flujo.md,
      docs/decisiones.md y docs/db.md. Las decisiones 30 y 31 ya contienen las
      aclaraciones; las decisiones técnicas 32 y 33 se registran en el mismo cambio.
- [x] **Private material (Restricciones)**: PASS — ninguna prueba o artefacto usa
      bjff-collection.csv ni docs/dataset.md; los datos sintéticos son nombres
      estructurales inventados.

## Project Structure

### Documentation (this feature)

```text
specs/003-structure-modeling/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── rest-api.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo generará speckit-tasks
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── common/
│   │   │   └── api-error.ts
│   │   ├── database/
│   │   │   ├── schema.types.ts
│   │   │   └── transaction.ts
│   │   ├── structure-templates/
│   │   │   ├── structure-templates.module.ts
│   │   │   ├── structure-templates.controller.ts
│   │   │   ├── structure-templates.service.ts
│   │   │   ├── structure-templates.repository.ts
│   │   │   └── dto.ts
│   │   └── schemes/
│   │       ├── schemes.module.ts
│   │       ├── schemes.controller.ts
│   │       ├── schemes.service.ts
│   │       ├── schemes.repository.ts
│   │       ├── structure-tree.ts
│   │       └── dto.ts
│   └── test/
│       ├── unit/
│       │   └── structure-tree.spec.ts
│       └── integration/
│           ├── structure-templates.spec.ts
│           ├── schemes.spec.ts
│           ├── structure-atomicity.spec.ts
│           └── structure-performance.spec.ts
└── web/
    └── src/
        ├── App.tsx
        ├── api/
        │   └── client.ts
        ├── components/
        │   ├── TreeEditor.tsx
        │   ├── DistributionSettingsForm.tsx
        │   └── SubtreeConfirmation.tsx
        └── pages/
            ├── TemplatesPage.tsx
            ├── TemplateEditorPage.tsx
            ├── SchemesPage.tsx
            └── SchemeEditorPage.tsx

packages/
└── api-types/
    └── src/
        └── index.ts

database/
├── 01_schema.sql        # Sin cambios
├── 02_functions_triggers.sql
├── 03_views.sql
└── migrations/          # Sin archivo nuevo para 003
```

**Structure Decision**: se conservan los workspaces existentes. Los dos módulos
NestJS reflejan ciclos de vida distintos. schemes contiene los algoritmos puros del
árbol concreto porque ningún otro workspace los necesita hoy. api-types amplía el
contrato compartido; no contiene reglas. El frontend agrega páginas y componentes,
pero delega todas las decisiones al backend.

## Diseño de implementación

### Plantillas

El módulo structure-templates ofrece consulta, creación, metadatos, nodos, orden,
movimiento, activación, archivo, disponibilidad y borrado confirmado. El repositorio
solo expresa consultas. El servicio valida estado, jerarquía, ciclos, roles y rutas
habilitadas, y traduce restricciones conocidas a errores del contrato.

### Schemes y locations

El módulo schemes gestiona cabecera, copia, locations, orden, movimiento, settings y
definición. structure-tree.ts contiene funciones puras para:

- indexar árboles por identificador;
- detectar ciclos y descendencia;
- determinar disponibilidad de una ruta;
- validar permutaciones;
- recorrer en profundidad y producir leaf_sequence.

La copia usa un mapa de locationId antiguo a nuevo. El borrado confirmado obtiene
profundidades y elimina de hojas a raíz. La definición bloquea el scheme durante la
transacción, valida el estado DRAFT, limpia secuencias previas, escribe 1..N y cambia
el status a DEFINED.

### Contrato y frontend

packages/api-types incorpora DTOs, estados y códigos de error de
contracts/rest-api.md. El cliente web solo envía intenciones: crear, mover, ordenar,
confirmar, definir o cambiar settings. El árbol se vuelve a leer después de una
mutación para que PostgreSQL y el servicio sigan siendo la fuente de verdad.

Los editores incluyen controles de teclado para subir y bajar; el arrastre nativo es
un atajo opcional. La confirmación destructiva usa la vista previa devuelta por la
API. Los errores conservan foco y se anuncian mediante regiones de estado.

### Pruebas

Las unitarias cubren permutaciones, ramas deshabilitadas, ciclos y DFS. Las de
integración cubren el contrato completo, estados, restricciones, settings, linaje,
copias, fallos transaccionales y sesión obligatoria. La prueba de 1 000 locations se
ejecuta con PERF=1.

## Complejidad

No hay violaciones constitucionales que justificar. El diseño agrega dos módulos de
feature dentro de las aplicaciones existentes y ninguna capa, dependencia, tabla o
workspace transversal.

## Revisión posterior al diseño

Los artefactos de Fase 1 conservan los gates:

- data-model.md usa exclusivamente la línea base;
- contracts/rest-api.md no expone distribución ni lógica al cliente;
- quickstart.md valida seguridad, atomicidad, privacidad y ausencia de corridas;
- research.md resuelve todas las incógnitas y documenta alternativas.

Resultado final del gate: PASS, sin excepciones ni Complexity Tracking pendiente.
