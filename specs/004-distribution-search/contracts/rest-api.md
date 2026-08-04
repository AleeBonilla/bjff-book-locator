# Contrato REST: Distribución y búsqueda pública

**Base administrativa**: `/api/distribution-runs`

**Base pública**: `/api/public`

Las rutas administrativas exigen la cookie de sesión vigente. Solo la búsqueda
pública se marca con `@Public()`. Todas las respuestas de error conservan la envoltura
existente `{ "error": { "code", "message", "details" } }`.

## Tipos comunes

```ts
type DistributionStrategy = 'CAPACITY' | 'WEIGHTED' | 'ANCHORED' | 'HYBRID' | 'MANUAL';

type DistributionStatus = 'PENDING' | 'DONE' | 'ERROR';
type RangeSource = 'AUTO' | 'ANCHORED' | 'MANUAL';

interface RunDefaults {
  capacity: { value: number; unit: 'BOOKS' | 'CENTIMETERS' | 'WEIGHT' } | null;
  targetFillRatio: number;
  allowOverflow: boolean;
}

interface AnchorInput {
  locationId: number;
  boundaryCode: string;
}

interface ManualRangeInput {
  locationId: number;
  startCode: string | null;
  endCode: string | null;
}

interface DistributionWarnings {
  unassignedCount: number;
  emptyPositionCount: number;
  overloadedPositionCount: number;
  splitKeyCount: number;
}
```

En un rango manual, `null` representa el inicio global en `startCode` y el sentinel
final en `endCode`. El cliente nunca envía claves comparables ni secuencias físicas. El
backend las deriva y valida.

## Forma resumida de corrida

```json
{
  "distributionRunId": 41,
  "schemeId": 7,
  "collectionLoadId": 12,
  "basedOnDistributionRunId": null,
  "strategy": "HYBRID",
  "status": "DONE",
  "revision": 3,
  "defaults": {
    "capacity": { "value": 40, "unit": "BOOKS" },
    "targetFillRatio": 0.85,
    "allowOverflow": false
  },
  "counters": {
    "bookCount": 24000,
    "positionCount": 620,
    "unassignedCount": 15
  },
  "isPublished": false,
  "publishedAt": null,
  "errorMessage": null,
  "createdBy": { "userId": 1, "username": "admin" },
  "createdAt": "2026-08-03T15:00:00.000Z",
  "finishedAt": "2026-08-03T15:00:06.000Z"
}
```

El detalle agrega posiciones congeladas con su ruta y resolución, anchors, rangos,
advertencias y, cuando corresponde, resumen de diferencias contra la corrida base. No
incluye la lista completa de placements; estos se consultan mediante conteos,
incidencias y búsquedas de prueba.

## Listar corridas

```http
GET /api/distribution-runs?schemeId=7&status=DONE&limit=50&offset=0
```

Respuesta `200`: `Paginado<DistributionRunSummary>`, ordenado por fecha e identificador
descendentes. Todos los filtros son opcionales.

## Crear y calcular

```http
POST /api/distribution-runs
Content-Type: application/json
```

```json
{
  "schemeId": 7,
  "collectionLoadId": 12,
  "basedOnDistributionRunId": null,
  "strategy": "HYBRID",
  "defaults": {
    "capacity": { "value": 40, "unit": "BOOKS" },
    "targetFillRatio": 0.85,
    "allowOverflow": false
  },
  "anchors": [{ "locationId": 101, "boundaryCode": "600" }],
  "manualRanges": []
}
```

Respuesta `201`: detalle `DONE` con `revision = 1`.

La estrategia predeterminada es `HYBRID`. Si `basedOnDistributionRunId` existe, debe
pertenecer al mismo scheme. La interfaz obtiene la precarga desde la plantilla de
derivación del backend, puede modificarla y siempre declara las entradas completas de
la nueva corrida. Una carga o estrategia distinta crea esta nueva identidad, nunca
modifica la base.

Si el cálculo falla, la cabecera queda en `ERROR` y la API responde `422` para una
entrada de dominio inválida o `500` para un fallo inesperado. `details.runId` permite
consultar el diagnóstico sin exponer material privado.

## Consultar detalle

```http
GET /api/distribution-runs/41
```

Respuesta `200`: `DistributionRunDetail`.

## Recalcular

```http
POST /api/distribution-runs/41/recalculate
Content-Type: application/json
```

```json
{
  "expectedRevision": 3,
  "rebuildSnapshot": true,
  "defaults": {
    "capacity": { "value": 45, "unit": "BOOKS" },
    "targetFillRatio": 0.85,
    "allowOverflow": false
  },
  "anchors": [{ "locationId": 101, "boundaryCode": "610" }],
  "manualRanges": []
}
```

Respuesta `200`: detalle recalculado con `revision = 4`.

El comando sustituye el conjunto completo de defaults y entradas admitidas por la
estrategia. No acepta `schemeId`, `collectionLoadId` ni `strategy`. Solo se permite
sobre una corrida no publicada en `DONE` o sobre una corrida inicial en `ERROR`. En
`ERROR` no existe una vista previa anterior que conservar. Un reintento exitoso pasa a
`DONE` e incrementa la revisión. Un reintento fallido responde con error, mantiene
`ERROR`, actualiza el diagnóstico, incrementa la revisión y no deja resultados
parciales. La respuesta de error incluye la revisión vigente en `details.revision`.

## Obtener plantilla de derivación

```http
GET /api/distribution-runs/41/derivation-template
```

Respuesta `200`:

```json
{
  "basedOnDistributionRunId": 41,
  "schemeId": 7,
  "suggestedCollectionLoadId": 12,
  "strategy": "HYBRID",
  "defaults": {
    "capacity": { "value": 45, "unit": "BOOKS" },
    "targetFillRatio": 0.85,
    "allowOverflow": false
  },
  "anchors": [{ "locationId": 101, "boundaryCode": "610" }],
  "manualRanges": []
}
```

La plantilla se calcula con las reglas del backend y la configuración vigente. Incluye
solo entradas editables y nunca contiene snapshot, placements, rangos calculados,
contadores ni revisiones. La persona puede elegir otra carga `DONE` y modificar las
entradas antes de enviarlas mediante `POST /api/distribution-runs`.

## Comparar versiones

```http
GET /api/distribution-runs/41/comparison?againstRunId=38
```

Respuesta `200`:

```json
{
  "runId": 41,
  "againstRunId": 38,
  "counterChanges": {
    "assigned": 120,
    "unassigned": -15,
    "emptyPositions": -2,
    "overloadedPositions": 1,
    "splitKeys": 0
  },
  "rangeChanges": [
    {
      "locationId": 101,
      "path": "Sección B / Estantería 1 / Anaquel 1",
      "before": { "startCode": "600", "endCode": "620" },
      "after": { "startCode": "610", "endCode": "630" }
    }
  ]
}
```

Ambas corridas deben pertenecer al mismo scheme. Si se omite `againstRunId`, se usa la
corrida base; si no hay base, se responde `422 COMPARISON_BASE_REQUIRED`.

## Búsqueda de prueba administrativa

```http
POST /api/distribution-runs/41/test-search
Content-Type: application/json

{ "classificationCode": "658.4 A123" }
```

Respuesta `200`: la misma forma de resultado público, pero limitada a la corrida
indicada. Acepta corridas `DONE` aunque no estén publicadas. No cambia datos.

Un código vacío, sin clase numérica, con caracteres ajenos al formato o con segmentos
ambiguos responde:

```http
HTTP/1.1 422 Unprocessable Entity
```

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "El código no tiene un formato de clasificación utilizable."
  }
}
```

La validación es la misma que protege la búsqueda pública, aunque esta última expresa
el caso como `NOT_FOUND` para mantener una respuesta pública uniforme.

## Registrar revisión de un rango

```http
PUT /api/distribution-runs/41/ranges/88/review
Content-Type: application/json
```

```json
{
  "expectedRevision": 4,
  "notes": "Frontera revisada administrativamente"
}
```

Respuesta `200`: rango actualizado y nueva revisión de la corrida. `notes: null`
elimina la revisión. Solo se permite sobre una corrida no publicada `DONE`; el texto
no convierte la ubicación en confirmada.

## Publicar y activar

```http
POST /api/distribution-runs/41/publish
Content-Type: application/json
```

```json
{
  "expectedRevision": 5,
  "previewAccepted": true,
  "unassignedAccepted": true
}
```

Respuesta `200`: detalle publicado con revisión incrementada.

`previewAccepted` siempre debe ser `true`. `unassignedAccepted` solo es obligatorio
cuando `unassignedCount > 0`; no se infiere de la confirmación ordinaria. Posiciones
vacías, sobrecargas y claves divididas se devuelven como advertencias y no bloquean.
Publicar otra corrida anterior `DONE` usa el mismo endpoint.

## Búsqueda pública

```http
POST /api/public/search
Content-Type: application/json

{ "classificationCode": "658.4 A123" }
```

Respuesta `200` con coincidencia:

```json
{
  "status": "FOUND",
  "matchType": "EXACT",
  "approximate": true,
  "message": "Ubicación aproximada",
  "locations": [
    {
      "path": "Sección B / Estantería 1 / Anaquel 1",
      "mapElementId": null
    }
  ]
}
```

`matchType` es `EXACT` o `RANGE`. Las rutas se deduplican y conservan el orden físico.

Respuesta `200` sin ubicación:

```json
{
  "status": "NOT_FOUND",
  "matchType": null,
  "approximate": true,
  "message": "No hay una ubicación aproximada disponible para este código.",
  "locations": []
}
```

Se usa para entrada vacía o sin clave, ausencia de publicación y coincidencias exactas
sin placements. La respuesta no revela nombres de cargas,
estrategias, contadores, revisiones ni identificadores internos.

### Abrir la búsqueda en la interfaz

```http
POST /api/public/search/open
Content-Type: application/json

{ "classificationCode": " 658. 8 T111-t 23 " }
```

Respuesta pública y sin body de resultado:

```http
HTTP/1.1 303 See Other
Location: https://origen-web-configurado/buscar?codigo=+658.+8+T111-t+23+
Cache-Control: no-store
Referrer-Policy: no-referrer
```

El código se conserva sin normalizar y se codifica como un único parámetro `codigo`.
La interfaz lo coloca en el campo y ejecuta automáticamente la consulta pública. El
origen de `Location` procede únicamente de `WEB_ORIGIN`; campos adicionales como
`returnTo` se rechazan y nunca pueden elegir el destino.

## Errores nuevos

| Código                             | HTTP | Cuándo                                                              |
| ---------------------------------- | ---: | ------------------------------------------------------------------- |
| `DISTRIBUTION_RUN_NOT_FOUND`       |  404 | La corrida no existe.                                               |
| `DISTRIBUTION_RANGE_NOT_FOUND`     |  404 | El rango no pertenece a la corrida.                                 |
| `RUN_BUSY`                         |  409 | Otra mutación conserva el lock de la corrida.                       |
| `RUN_VERSION_CONFLICT`             |  409 | `expectedRevision` no coincide. Incluye `currentRevision`.          |
| `RUN_IMMUTABLE`                    |  409 | Se intenta modificar una corrida publicada.                         |
| `INVALID_RUN_STATE`                |  409 | El estado no admite la acción.                                      |
| `INVALID_RUN_LINEAGE`              |  422 | Base ausente, de otro scheme o cíclica.                             |
| `INVALID_STRATEGY_INPUTS`          |  422 | Faltan o sobran entradas para la estrategia.                        |
| `INVALID_EFFECTIVE_CONFIGURATION`  |  422 | No se puede resolver una posición o las unidades son incompatibles. |
| `INVALID_ANCHORS`                  |  422 | Anchor inválido, duplicado o desordenado.                           |
| `INVALID_MANUAL_RANGES`            |  422 | Cobertura manual incompleta, desordenada o solapada.                |
| `COMPARISON_BASE_REQUIRED`         |  422 | No hay corrida contra la cual comparar.                             |
| `UNASSIGNED_CONFIRMATION_REQUIRED` |  409 | Falta la confirmación adicional. Incluye el conteo.                 |

Los errores de entrada pueden incluir identificadores de corrida, posición o rango,
pero no claves, códigos, títulos, autores ni contenido privado en logs.
