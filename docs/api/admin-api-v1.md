# API administrativa V1

| Propiedad | Valor |
|---|---|
| Estado | Implementada sin autenticación para desarrollo local |
| Alcance | Configuración, revisión, publicación y clonación de esquemas |
| Fuentes | [`apps/api/src/admin`](../../apps/api/src/admin), [`apps/api/src/maps`](../../apps/api/src/maps) y [`database`](../../database) |
| Autoridad funcional | [Flujo de la aplicación V1](../workflows/application-workflow-v1.md) |
| Revisar cuando | Cambien las rutas `/api/admin`, los DTO, la configuración o el ciclo de archivos SVG |

La API aplica el flujo administrativo y es el único componente que accede a PostgreSQL. Este documento define su interfaz HTTP; las reglas de estados, rangos, mapas y publicación pertenecen al workflow enlazado.

## Acceso temporal

La V1 no implementa login. `ALLOW_UNAUTHENTICATED_ADMIN=true` habilita las rutas administrativas y `ADMIN_ACTOR_USERNAME` identifica el registro técnico utilizado en auditoría. La API rechaza esta combinación cuando `NODE_ENV=production`.

La migración [`003_seed_system_actor.sql`](../../database/003_seed_system_actor.sql) crea `system-v1`. La futura autenticación debe sustituir la resolución de este actor sin cambiar los servicios transaccionales.

## Formato común

Una respuesta correcta contiene `data`:

```json
{
  "data": {}
}
```

Un error contiene un código estable, un mensaje presentable y detalles opcionales:

```json
{
  "error": {
    "code": "SCHEME_NOT_PUBLISHABLE",
    "message": "El esquema todavía no se puede publicar.",
    "details": []
  }
}
```

La API usa `400` para formatos inválidos, `404` para recursos inexistentes, `409` para conflictos de etapa o inmutabilidad y `422` para reglas funcionales incumplidas.

## Rutas

Todas las rutas de la tabla parten de `/api/admin/schemes`.

| Método y ruta | Entrada principal | Resultado |
|---|---|---|
| `GET /` | Ninguna | Lista de esquemas, estados y cantidades. |
| `POST /` | `name`, `shortDescription?` | Esquema `DRAFT` con `ddc-base-v1`. |
| `GET /:schemeId` | Ninguna | Esquema, niveles visibles y ubicaciones visibles. |
| `PATCH /:schemeId` | `name?`, `shortDescription?` | Metadatos actualizados si no está publicado. |
| `DELETE /:schemeId` | `confirmDataLoss: true` | Elimina el esquema y todos sus datos, aunque esté publicado o activo. |
| `POST /:schemeId/clone` | `name`, `scope` | Clon `levels`, `levels_and_locations` o `all`. |
| `GET, PUT /:schemeId/levels` | `PUT`: arreglo `levels` | Consulta o reemplaza la gramática física en `DRAFT`. |
| `POST /:schemeId/levels/confirm` | Ninguna | Crea la ubicación raíz interna y pasa a `LEVELS_DEFINED`. |
| `GET, POST /:schemeId/locations` | `POST`: `parentLocationId`, `quantity`, `schemeLevelId?` | Consulta o añade ubicaciones. `null` selecciona la raíz interna. |
| `DELETE /:schemeId/locations/:locationId` | Ninguna | Elimina la ubicación y su subárbol editable. |
| `POST /:schemeId/locations/confirm` | Ninguna | Valida ramas y pasa a `LOCATIONS_DEFINED`. |
| `POST /:schemeId/actions/reopen-locations` | `confirmDataLoss: true` | Elimina mapas y rangos y vuelve a `LEVELS_DEFINED`. |
| `POST /:schemeId/actions/reopen-levels` | `confirmDataLoss: true` | Elimina la estructura dependiente y vuelve a `DRAFT`. |
| `GET /:schemeId/locations.csv` | Query opcional `levelId` | Tabla de rutas completa o terminada en un nivel físico. |
| `GET /:schemeId/locations.txt` | Ninguna | Árbol textual completo con nombres y códigos. |
| `GET, PUT /:schemeId/ranges` | `PUT`: arreglo `items` | Consulta coberturas o guarda rangos en lote. |
| `PUT, DELETE /:schemeId/ranges/:locationId` | `PUT`: `rangeStart`, `rangeEnd` | Guarda o retira un rango terminal. |
| `GET /:schemeId/maps` | Ninguna | Capas, SVG, niveles y asignaciones. |
| `POST /:schemeId/maps/top` | Carga multipart TOP | Crea una capa superior y su SVG. |
| `POST /:schemeId/maps/front` | `name`, `representedLevelId` | Crea una capa frontal. |
| `POST /:schemeId/maps/front/:layerId/variants` | Carga multipart FRONT | Añade una variante con slots. |
| `PUT, DELETE /:schemeId/maps/svgs/:svgId` | `PUT`: carga multipart | Reemplaza metadatos o archivo, o elimina el SVG. |
| `PATCH /:schemeId/maps/layers/:layerId` | `name?`, `enabled?` | Cambia el nombre o la disponibilidad de una capa editable. |
| `DELETE /:schemeId/maps/layers/:layerId` | Ninguna | Elimina capa, relaciones y archivos asociados. |
| `PUT /:schemeId/maps/layers/:layerId/assignments/:contextLocationId` | `mapLayerSvgId` | Asigna o retira una variante frontal. |
| `PUT /:schemeId/maps/layers/:layerId/drilldowns/:schemeLevelId` | `frontLayerId` | Configura el enlace TOP a FRONT. |
| `POST /:schemeId/maps/validate` | Ninguna | Calcula cobertura y bloqueos actuales. |
| `GET /:schemeId/review` | Ninguna | Resume estructura, rangos, mapas y publicación. |
| `POST /:schemeId/publish` | `activate` | Publica y, opcionalmente, activa. |
| `POST /:schemeId/activate` | Ninguna | Activa un esquema ya publicado. |
| `POST /:schemeId/search-tests` | `callNumber` | Devuelve coincidencias, rutas y vistas disponibles. |

## Definición de niveles

`PUT /:schemeId/levels` recibe claves temporales para expresar padres sin depender de identificadores de base de datos:

```json
{
  "levels": [
    {
      "key": "floor",
      "parentKey": null,
      "name": "Piso",
      "sortOrder": 1,
      "isSearchTerminal": false
    },
    {
      "key": "shelf",
      "parentKey": "floor",
      "name": "Anaquel",
      "sortOrder": 1,
      "isSearchTerminal": true
    }
  ]
}
```

La respuesta excluye el nivel y la ubicación raíz internos.

## Exportación de ubicaciones

Sin `levelId`, `locations.csv` crea una fila por ubicación del último nivel físico. Cada fila contiene la ruta completa hasta esa ubicación. Con `levelId`, crea una fila por ubicación del nivel solicitado y termina allí la ruta. Esto permite generar, por ejemplo, una tabla de muebles distinta de la tabla completa de anaqueles. Un nivel ajeno al esquema produce `INVALID_CSV_LEVEL`.

Cada nivel de la ruta ocupa dos columnas, una para el nombre y otra para el código. Los encabezados se derivan de los nombres de los niveles:

```text
fila_name;fila_code;cara_name;cara_code;mueble_name;mueble_code;anaquel_name;anaquel_code
```

El archivo usa UTF-8 con BOM, punto y coma como separador y respeta el `sort_order` de cada rama.

`locations.txt` incluye todas las ubicaciones físicas. Presenta primero cada padre, indenta sus descendientes con dos espacios por nivel y coloca el código entre corchetes:

```text
Fila 1 [4-1]
  Cara 1 [4-1-1]
    Mueble 1 [4-1-1-1]
      Anaquel 1 [4-1-1-1-1]
```

## Cargas SVG

Las cargas usan el campo binario `svg` y el campo textual `metadata`, cuyo contenido es JSON.

Una carga TOP requiere:

```json
{
  "name": "Plano principal",
  "svgName": "Piso 1",
  "representedLevelIds": [12]
}
```

Una variante FRONT requiere:

```json
{
  "name": "Mueble de cinco anaqueles",
  "variantCode": "shelves-5",
  "slotCount": 5
}
```

El límite predeterminado es 10 MiB. Solo la versión sanitizada se almacena y se expone bajo `/api/assets/maps/`.

Una capa deshabilitada permanece configurada, pero no participa en validación, publicación ni resultados visuales. Los cambios de nombre y disponibilidad están prohibidos después de publicar.

## Resultado de búsqueda interna

`search-tests` devuelve todas las coincidencias solapadas. Cada coincidencia contiene su rango y ruta textual. `maps.topViews` añade `highlightLocationCodes`; `maps.frontViews` agrupa cada contexto y añade `highlightSlots`. Ambos arreglos pueden estar vacíos cuando el esquema todavía no tiene mapas.

## Archivos locales

`SVG_STORAGE_DIR` contiene un directorio por esquema. Los nombres son UUID y no reutilizan el nombre enviado por el usuario. Un reemplazo escribe el archivo nuevo antes de actualizar la referencia y retira el anterior después de confirmar PostgreSQL.

Ejecute desde la raíz:

```powershell
npm run assets:reconcile
```

El comando elimina temporales y SVG sin referencia en `map_layer_svgs`. No mantiene historial de versiones.

## Eliminación de esquemas

`DELETE /:schemeId` exige el cuerpo `{ "confirmDataLoss": true }`. Esta operación es la única excepción a la inmutabilidad de un esquema publicado: elimina niveles, ubicaciones, rangos, capas, variantes, asignaciones y relaciones en una transacción. Los archivos se retiran después de confirmar PostgreSQL.

La respuesta informa si el esquema estaba activo o publicado. Si se elimina el activo, la API no selecciona un reemplazo y el sistema queda sin esquema activo hasta que un administrador active otro.
