# Contrato REST: Carga administrativa inicial de la colección

**Fecha**: 2026-07-30 | **Spec**: [spec.md](../spec.md)

Base: `/api`. Todo el contrato exige sesión activa salvo el inicio de sesión
(**FR-004**, **FR-042**). Esta funcionalidad no expone ningún recurso público.

## Convenciones

**Sesión**: cookie `httpOnly`, `SameSite=Lax`, y `Secure` fuera de desarrollo. El
cliente nunca lee ni construye el identificador de sesión.

**Errores**: envoltura única.

```json
{ "error": { "code": "MISSING_REQUIRED_COLUMN", "message": "Falta la columna Clasificacion.", "details": { "column": "Clasificacion" } } }
```

`message` está en español y es apto para mostrarse a la persona usuaria (**SC-010**).
`details` es opcional.

**Ausencia de sesión**: cualquier recurso responde `401` con código `UNAUTHENTICATED` y
sin filtrar datos de la colección.

## Autenticación

### `POST /api/auth/login`

```json
{ "username": "abonilla", "password": "..." }
```

| Estado | Cuerpo | Caso |
|---|---|---|
| `200` | `{ "user": Usuario }` | Credenciales válidas y cuenta habilitada (**FR-001**) |
| `401` | `INVALID_CREDENTIALS` | Credenciales inválidas **o** cuenta deshabilitada (**FR-002**) |

La respuesta `401` es idéntica en ambos casos: no revela si la cuenta existe ni cuál de
los dos datos falló. El tiempo de respuesta tampoco debe distinguirlos.

`Usuario`: `{ "userId": number, "username": string, "fullName": string | null, "role": "ADMIN" }`

Un acceso exitoso actualiza `lastLoginAt` (**FR-006**).

### `POST /api/auth/logout`

| Estado | Caso |
|---|---|
| `204` | Sesión invalidada de inmediato (**FR-003**) |

### `GET /api/auth/session`

| Estado | Cuerpo | Caso |
|---|---|---|
| `200` | `{ "user": Usuario }` | Sesión activa |
| `401` | `UNAUTHENTICATED` | Sin sesión |

Permite al frontend restaurar el estado de acceso al recargar.

## Importación

### `POST /api/collection-loads`

`multipart/form-data` con `file` (obligatorio) y `title` (opcional; por defecto, el
nombre del archivo).

Procesamiento **síncrono**: la respuesta trae el estado final y los contadores
(**FR-026a**).

#### Rechazo del archivo, sin crear carga

El contrato del archivo se valida antes de crear nada. Ninguno de estos casos deja
rastro en el historial de cargas.

| Estado | Código | Caso | Requisito |
|---|---|---|---|
| `400` | `NO_FILE` | No se envió archivo | — |
| `413` | `FILE_TOO_LARGE` | Supera el tamaño máximo | FR-013a |
| `422` | `TOO_MANY_ROWS` | Supera el número máximo de filas | FR-013a |
| `422` | `INVALID_ENCODING` | No es legible como UTF-8 | FR-013 |
| `422` | `EMPTY_FILE` | Archivo vacío | FR-013 |
| `422` | `MISSING_HEADER` | Sin fila de encabezado | FR-013 |
| `422` | `MISSING_REQUIRED_COLUMN` | Falta `codBarras` o `Clasificacion` | FR-010, FR-013 |

`FILE_TOO_LARGE` y `TOO_MANY_ROWS` indican en `details` el límite excedido y su valor.

#### Archivo aceptado

| Estado | Cuerpo | Caso |
|---|---|---|
| `201` | `Carga` | El archivo es un CSV de colección válido y se procesó |

`201` no implica éxito de la importación: significa que la carga existe y alcanzó un
estado final. Hay que leer `status`.

| `status` | Significado |
|---|---|
| `DONE` | Registros disponibles para uso posterior (**FR-028a**) |
| `ERROR` | La importación falló; ningún registro disponible (**FR-028**) |

Motivos de `ERROR`, en `errorMessage`:

| Situación | Requisito |
|---|---|
| El pie `TOTAL;n` no coincide con las filas leídas | FR-032 |
| Fallo al persistir la carga completa | FR-028 |

Dos importaciones simultáneas producen cargas independientes; ninguna se rechaza por
existir otra en curso (**FR-029**).

## Consulta

### `GET /api/collection-loads`

Parámetros: `limit` (por defecto 50, máximo 200), `offset`.

```json
{ "items": [ResumenDeCarga], "total": 3 }
```

Ordenadas por fecha de creación descendente (**FR-041**). Se conservan salvo que
alguien las elimine de forma explícita, con `DELETE /api/collection-loads/{id}`.

### `GET /api/collection-loads/{id}`

| Estado | Cuerpo |
|---|---|
| `200` | `Carga` |
| `404` | `LOAD_NOT_FOUND` |

### `GET /api/collection-loads/{id}/errors`

Parámetros: `severity` (`REVIEW` \| `REJECTED`), `limit`, `offset`.

```json
{ "items": [ProblemaDeCarga], "total": 11 }
```

Ordenados por número de fila ascendente (**FR-038**).

### `DELETE /api/collection-loads/{id}`

Elimina la carga con sus registros y sus problemas. Añadido por
[`002-load-management`](../../002-load-management/spec.md).

| Estado | Código | Caso |
|---|---|---|
| `204` | — | Eliminada (**FR-001**) |
| `404` | `LOAD_NOT_FOUND` | La carga no existe (**FR-006**) |
| `409` | `LOAD_IN_USE` | Una corrida de distribución la utiliza (**FR-005**) |

No es reversible. La confirmación previa corresponde a la interfaz (**FR-002**).

### `GET /api/collection-loads/{id}/books`

Parámetros: `limit`, `offset`, `withoutKey` (booleano).

```json
{ "items": [Registro], "total": 44 }
```

Ordenados por `sourceRowNumber` ascendente.

## Representaciones

### `Carga`

```json
{
  "collectionLoadId": 1,
  "title": "Colección julio 2026",
  "filename": "bjff-collection-example.csv",
  "status": "DONE",
  "counters": {
    "rowsRead": 44,
    "rowsImported": 44,
    "rowsWithoutKey": 1,
    "rowsFlagged": 11,
    "rowsRejected": 0
  },
  "errorMessage": null,
  "createdBy": { "userId": 1, "username": "abonilla" },
  "createdAt": "2026-07-30T14:22:10.512Z"
}
```

`ResumenDeCarga` es lo mismo sin `errorMessage`.

### `ProblemaDeCarga`

```json
{
  "collectionLoadErrorId": 7,
  "rowNumber": 37,
  "severity": "REVIEW",
  "reason": "Más de tres dígitos antes del punto DDC.",
  "classificationRaw": "8693.7 M378a 23",
  "rawContent": "1034;9034;..."
}
```

`classificationRaw` es el código original de la fila que provocó el problema
(**FR-038a**). Es `null` cuando la fila no llegó a importarse, como en un rechazo por
número de campos.

`rawContent` puede contener datos de la colección privada. Solo se entrega con sesión
activa y nunca aparece en registros de operación (**FR-043**, **FR-044**).

### `Registro`

```json
{
  "bookId": 12,
  "sourceRowNumber": 5,
  "sourceBarcode": "1005",
  "classificationRaw": "352,85 C333c 23",
  "comparableKey": "352.85 C333C",
  "isbn": "9789968319843",
  "title": "Coma decimal",
  "author": "Autora, Prueba",
  "copyLabel": "Ej.01",
  "year": 2013
}
```

`classificationRaw` conserva el valor original sin alterar (**FR-016**).
`comparableKey` es derivada y puede ser `null` (**FR-024**). `year` puede ser `null`
cuando el archivo traía `0` o un valor fuera del intervalo (**FR-011a**, **FR-011b**).

> El ejemplo usa filas de `bjff-collection-example.csv`, archivo publicable. Ninguna
> representación de este contrato reproduce datos de la colección real.

## Fuera de este contrato

Coherente con el alcance de la especificación: no hay recursos para registrar cuentas,
recuperar contraseñas, eliminar u ocultar cargas, corregir filas, ni nada relativo a
plantillas, esquemas, distribuciones o búsqueda pública.
