# Contrato REST: Modelado de la estructura física

**Fecha**: 2026-07-31 | **Spec**: [spec.md](../spec.md)

Base: /api. Todos los recursos exigen la cookie de sesión administrativa que ya usa 001. Esta feature no expone rutas públicas.

## Convenciones

### Errores

Se conserva la envoltura existente:

```json
{
  "error": {
    "code": "INVALID_TEMPLATE_TREE",
    "message": "La plantilla no tiene una posición utilizable.",
    "details": {
      "violations": [
        {
          "elementType": "template",
          "elementId": 4,
          "rule": "REQUIRES_REACHABLE_POSITION"
        }
      ]
    }
  }
}
```

Los mensajes están en español y details es opcional. Cualquier ruta sin sesión
responde 401 UNAUTHENTICATED.

### Fechas, números y árboles

- Las fechas son cadenas ISO 8601 en UTC.
- Los identificadores son enteros positivos.
- Capacidad y targetFillRatio se representan como number, aunque PostgreSQL use
  NUMERIC.
- Las respuestas de detalle contienen árboles anidados y ordenados.
- Las mutaciones operan por identificador y nunca aceptan leafSequence.
- position es un índice basado en cero dentro del nuevo grupo de hermanos.

### Paginación

Los listados usan limit, offset y la forma compartida:

```json
{ "items": [], "total": 0 }
```

limit vale 50 por defecto y 200 como máximo.

## Representaciones

### Plantilla

```json
{
  "structureTemplateId": 4,
  "name": "Sección tradicional",
  "description": "Sección, cara, estantería y anaquel",
  "status": "ACTIVE",
  "enabled": true,
  "createdBy": {
    "userId": 1,
    "username": "admin"
  },
  "createdAt": "2026-07-31T15:00:00.000Z",
  "updatedAt": "2026-07-31T15:05:00.000Z"
}
```

PlantillaDetalle agrega nodes:

```json
{
  "nodes": [
    {
      "structureTemplateNodeId": 10,
      "parentTemplateNodeId": null,
      "name": "Sección",
      "role": "CONTAINER",
      "position": 0,
      "visualKind": null,
      "enabled": true,
      "defaults": null,
      "children": [
        {
          "structureTemplateNodeId": 11,
          "parentTemplateNodeId": 10,
          "name": "Anaquel",
          "role": "POSITION",
          "position": 0,
          "visualKind": "shelf",
          "enabled": true,
          "defaults": {
            "capacity": { "value": 40, "unit": "BOOKS" },
            "targetFillRatio": 0.85,
            "allowOverflow": true
          },
          "children": []
        }
      ]
    }
  ]
}
```

defaults es nulo cuando no existe ningún valor. capacity es nula o contiene value y
unit juntas. En un CONTAINER, defaults siempre es nulo.

### Scheme

```json
{
  "schemeId": 8,
  "name": "Distribución planta principal 2026",
  "description": null,
  "status": "DEFINED",
  "enabled": true,
  "isActive": false,
  "basedOnSchemeId": null,
  "availableForNewRun": true,
  "unavailableReasons": [],
  "createdBy": {
    "userId": 1,
    "username": "admin"
  },
  "createdAt": "2026-07-31T16:00:00.000Z",
  "updatedAt": "2026-07-31T16:10:00.000Z"
}
```

unavailableReasons puede contener:

- SCHEME_DISABLED;
- SCHEME_NOT_DEFINED;
- TEMPLATE_DISABLED;
- NO_USABLE_POSITIONS.

SchemeDetalle agrega locations:

```json
{
  "locations": [
    {
      "locationId": 100,
      "parentLocationId": null,
      "structureTemplateId": 4,
      "structureTemplateNodeId": 10,
      "name": "Sección A",
      "role": "CONTAINER",
      "position": 0,
      "leafSequence": null,
      "mapElementId": null,
      "enabled": true,
      "usable": true,
      "settings": {
        "capacity": null,
        "targetFillRatio": 0.9,
        "allowOverflow": null,
        "inheritToDescendants": true,
        "updatedBy": {
          "userId": 1,
          "username": "admin"
        },
        "updatedAt": "2026-07-31T16:05:00.000Z"
      },
      "children": []
    }
  ]
}
```

role proviene del nodo de plantilla. usable es derivado de la plantilla, de los nodos
de plantilla y de la ruta concreta. leafSequence puede conservar un valor histórico
en un scheme DEFINED aunque usable pase a false después.

## Plantillas

### GET /api/structure-templates

Parámetros opcionales: status, enabled, limit, offset. Orden por updatedAt descendente
y luego por structureTemplateId.

Respuesta 200: Paginado<Plantilla>.

### POST /api/structure-templates

```json
{
  "name": "Sección tradicional",
  "description": "Sección, cara, estantería y anaquel"
}
```

Respuesta 201: PlantillaDetalle en DRAFT y habilitada.

Errores:

| Estado | Código                 | Caso                           |
| ------ | ---------------------- | ------------------------------ |
| 409    | TEMPLATE_NAME_CONFLICT | El nombre ya existe            |
| 422    | VALIDATION_FAILED      | Nombre o descripción inválidos |

### GET /api/structure-templates/{templateId}

| Estado | Resultado          |
| ------ | ------------------ |
| 200    | PlantillaDetalle   |
| 404    | TEMPLATE_NOT_FOUND |

La consulta administrativa incluye nodos deshabilitados.

### PATCH /api/structure-templates/{templateId}

Permite cambiar name, description y enabled. Cambiar enabled no cambia status.

```json
{
  "name": "Sección tradicional",
  "description": null,
  "enabled": false
}
```

Los campos omitidos no cambian. Respuesta 200: PlantillaDetalle.

### POST /api/structure-templates/{templateId}/activate

Sin cuerpo. Valida todo el árbol y cambia DRAFT a ACTIVE.

| Estado | Código                   | Caso                                                    |
| ------ | ------------------------ | ------------------------------------------------------- |
| 200    | —                        | Devuelve PlantillaDetalle ACTIVE                        |
| 404    | TEMPLATE_NOT_FOUND       | No existe                                               |
| 409    | INVALID_STATE_TRANSITION | No está en DRAFT                                        |
| 422    | INVALID_TEMPLATE_TREE    | Raíz, ciclo, rol, orden o POSITION alcanzable inválidos |

details.violations identifica cada elemento y regla.

### POST /api/structure-templates/{templateId}/archive

Sin cuerpo. Cambia ACTIVE a ARCHIVED y conserva sus instancias.
Las locations existentes permanecen utilizables mientras la plantilla siga habilitada.

| Estado | Código                   | Caso                               |
| ------ | ------------------------ | ---------------------------------- |
| 200    | —                        | Devuelve PlantillaDetalle ARCHIVED |
| 409    | INVALID_STATE_TRANSITION | No está en ACTIVE                  |

### POST /api/structure-templates/{templateId}/nodes

Solo DRAFT.

```json
{
  "parentTemplateNodeId": 10,
  "name": "Anaquel",
  "role": "POSITION",
  "position": 0,
  "visualKind": "shelf",
  "enabled": true,
  "defaults": {
    "capacity": { "value": 40, "unit": "BOOKS" },
    "targetFillRatio": 0.85,
    "allowOverflow": true
  }
}
```

parentTemplateNodeId es nulo para la raíz. position puede omitirse para agregar al
final. Respuesta 201: el nodo creado.

### PATCH /api/structure-templates/{templateId}/nodes/{nodeId}

Solo DRAFT. Permite cambiar name, role, visualKind, enabled y defaults. No mueve ni
reordena.

Un valor omitido no cambia; un valor nulo elimina el opcional correspondiente.
Cambiar a POSITION falla si el nodo tiene hijas. Respuesta 200: nodo actualizado.

### POST /api/structure-templates/{templateId}/nodes/{nodeId}/move

Solo DRAFT.

```json
{
  "parentTemplateNodeId": 20,
  "position": 1
}
```

Mueve el subárbol dentro de la misma plantilla. Rechaza POSITION como padre, ciclos y
una segunda raíz.

### PUT /api/structure-templates/{templateId}/nodes/order

Solo DRAFT. Reordena un grupo sin mover elementos entre padres.

```json
{
  "parentTemplateNodeId": 10,
  "orderedNodeIds": [13, 11, 12]
}
```

orderedNodeIds debe ser una permutación exacta de las hijas actuales. Respuesta 204.

### GET /api/structure-templates/{templateId}/nodes/{nodeId}/deletion-preview

Solo DRAFT. Respuesta 200:

```json
{
  "root": { "id": 10, "name": "Cara", "role": "CONTAINER" },
  "descendantCount": 8,
  "items": [{ "id": 10, "parentId": null, "name": "Cara", "role": "CONTAINER" }]
}
```

items contiene todo el subárbol en orden de recorrido.

### DELETE /api/structure-templates/{templateId}/nodes/{nodeId}?confirmed=true

Solo DRAFT. confirmed=true es obligatorio si el nodo tiene descendientes.

| Estado | Código                        | Caso                                     |
| ------ | ----------------------------- | ---------------------------------------- |
| 204    | —                             | Subárbol eliminado                       |
| 409    | SUBTREE_CONFIRMATION_REQUIRED | Tiene descendientes y falta confirmación |
| 409    | TEMPLATE_NOT_EDITABLE         | La plantilla no está en DRAFT            |

## Schemes

### GET /api/schemes

Parámetros opcionales: status, enabled, limit, offset. Respuesta 200:
Paginado<Scheme>.

### POST /api/schemes

```json
{
  "name": "Distribución planta principal 2026",
  "description": null
}
```

Respuesta 201: SchemeDetalle DRAFT, habilitado y sin locations.

### GET /api/schemes/{schemeId}

| Estado | Resultado                        |
| ------ | -------------------------------- |
| 200    | SchemeDetalle con árbol completo |
| 404    | SCHEME_NOT_FOUND                 |

### PATCH /api/schemes/{schemeId}

Permite cambiar name, description y enabled. No acepta status, isActive,
basedOnSchemeId ni leafSequence.

Los metadatos y enabled pueden cambiar en DRAFT o DEFINED. Respuesta 200:
SchemeDetalle.

### POST /api/schemes/{schemeId}/copy

```json
{
  "name": "Propuesta planta principal 2027",
  "description": "Copia para reorganización"
}
```

Copia locations, orden, enabled, mapElementId y settings. El nuevo scheme queda DRAFT,
habilitado, con basedOnSchemeId igual al origen y leafSequence nula.

| Estado | Código               | Caso                       |
| ------ | -------------------- | -------------------------- |
| 201    | —                    | Devuelve la copia completa |
| 404    | SCHEME_NOT_FOUND     | No existe el origen        |
| 409    | SCHEME_NAME_CONFLICT | El nombre ya existe        |
| 422    | SCHEME_LINEAGE_CYCLE | El linaje sería inválido   |

No copia corridas ni resultados.

### POST /api/schemes/{schemeId}/define

Sin cuerpo. Solo DRAFT. Valida el árbol, calcula leafSequence y cambia a DEFINED en una
transacción.

| Estado | Código                   | Caso                                     |
| ------ | ------------------------ | ---------------------------------------- |
| 200    | —                        | Devuelve SchemeDetalle DEFINED           |
| 409    | INVALID_STATE_TRANSITION | No está en DRAFT                         |
| 422    | INVALID_SCHEME_TREE      | Árbol inválido o sin POSITION utilizable |

Un scheme deshabilitado puede definirse; enabled controla la disponibilidad para una
corrida futura, no la integridad estructural.

## Locations

### POST /api/schemes/{schemeId}/locations

Solo en scheme DRAFT.

```json
{
  "parentLocationId": null,
  "structureTemplateId": 4,
  "structureTemplateNodeId": 10,
  "name": "Sección A",
  "position": 0,
  "mapElementId": null,
  "enabled": true
}
```

Para una raíz, el nodo debe ser la raíz de una plantilla ACTIVE y habilitada. Para una
hija, plantilla y nodo deben corresponder al padre concreto. position puede omitirse
para agregar al final.

Respuesta 201: location creada.

### PATCH /api/schemes/{schemeId}/locations/{locationId}

Solo en scheme DRAFT. Permite cambiar name, mapElementId y enabled. No cambia la
plantilla, el nodo, el padre, el orden ni leafSequence.

Respuesta 200: location actualizada.

### POST /api/schemes/{schemeId}/locations/{locationId}/move

Solo en scheme DRAFT.

```json
{
  "parentLocationId": 200,
  "position": 2
}
```

La nueva relación debe seguir la misma plantilla e instancia y corresponder a la
jerarquía de nodos. Rechaza ciclos y POSITION como padre.

### PUT /api/schemes/{schemeId}/locations/order

Solo en scheme DRAFT.

```json
{
  "parentLocationId": 200,
  "orderedLocationIds": [205, 203, 204]
}
```

parentLocationId nulo reordena las raíces. La lista debe ser una permutación exacta.
Respuesta 204.

### GET /api/schemes/{schemeId}/locations/{locationId}/deletion-preview

Solo en scheme DRAFT. Devuelve la misma forma de vista previa que los nodos, con roles
derivados y todas las locations del subárbol.

### DELETE /api/schemes/{schemeId}/locations/{locationId}?confirmed=true

Solo en scheme DRAFT. confirmed=true es obligatorio si existen descendientes.
Elimina el subárbol y sus settings de forma atómica. Respuesta 204.

### PUT /api/schemes/{schemeId}/locations/{locationId}/settings

Permitido en DRAFT y DEFINED.

```json
{
  "capacity": { "value": 120, "unit": "CENTIMETERS" },
  "targetFillRatio": 0.85,
  "allowOverflow": false
}
```

Es una sustitución completa:

- capacity es nula o contiene value y unit;
- targetFillRatio y allowOverflow pueden ser nulos;
- el servidor fija inheritToDescendants según el rol;
- si los tres aspectos son nulos, elimina la fila y responde 204;
- en otro caso crea o actualiza y responde 200 con el setting.

La operación nunca calcula configuración efectiva ni crea snapshots.

### DELETE /api/schemes/{schemeId}/locations/{locationId}/settings

Permitido en DRAFT y DEFINED. Elimina el ajuste vigente; no cambia árbol ni secuencia.
Respuesta 204 incluso si no había setting.

## Errores de dominio

| Estado | Código                        | Uso                                      |
| ------ | ----------------------------- | ---------------------------------------- |
| 404    | TEMPLATE_NOT_FOUND            | Plantilla inexistente                    |
| 404    | TEMPLATE_NODE_NOT_FOUND       | Nodo inexistente o de otra plantilla     |
| 404    | SCHEME_NOT_FOUND              | Scheme inexistente                       |
| 404    | LOCATION_NOT_FOUND            | Location inexistente o de otro scheme    |
| 409    | TEMPLATE_NOT_EDITABLE         | Mutación de nodos fuera de DRAFT         |
| 409    | SCHEME_NOT_EDITABLE           | Mutación estructural fuera de DRAFT      |
| 409    | INVALID_STATE_TRANSITION      | Transición no permitida                  |
| 409    | TEMPLATE_NAME_CONFLICT        | Nombre de plantilla repetido             |
| 409    | SCHEME_NAME_CONFLICT          | Nombre de scheme repetido                |
| 409    | SIBLING_NAME_CONFLICT         | Nombre repetido entre hermanos           |
| 409    | MAP_ELEMENT_CONFLICT          | mapElementId repetido en el scheme       |
| 409    | SUBTREE_CONFIRMATION_REQUIRED | Borrado destructivo no confirmado        |
| 422    | INVALID_TEMPLATE_TREE         | Árbol de plantilla inválido              |
| 422    | INVALID_SCHEME_TREE           | Árbol concreto inválido                  |
| 422    | INVALID_PARENT                | Relación padre-hija incompatible         |
| 422    | TREE_CYCLE                    | Movimiento que crea un ciclo             |
| 422    | ORDER_MISMATCH                | La lista no coincide con el grupo actual |
| 422    | INVALID_DISTRIBUTION_SETTINGS | Valores o rol incompatibles              |

Los errores conocidos de unicidad, checks y llaves de PostgreSQL se traducen a estos
códigos. Un error inesperado conserva INTERNAL_ERROR y no expone SQL.

## Fuera de este contrato

No hay endpoints para:

- crear distribution_runs o elegir collection_loads;
- resolver o congelar configuración efectiva;
- administrar anchors, rangos o placements;
- cambiar un scheme a DISTRIBUTED o activar uno;
- crear o modificar mapas SVG;
- buscar libros públicamente.
