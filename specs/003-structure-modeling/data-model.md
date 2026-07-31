# Modelo de datos: Modelado de la estructura física

**Fecha**: 2026-07-31 | **Spec**: [spec.md](spec.md)

Esta funcionalidad no crea tablas ni columnas. Usa la línea base de
database/01_schema.sql y deja database/migrations sin cambios. El documento distingue
lo que ya garantiza PostgreSQL de lo que debe validar el servicio.

Para el diccionario completo, ver [docs/db.md](../../docs/db.md).

## Alcance sobre el esquema

| Tabla                          | Uso                                                  |
| ------------------------------ | ---------------------------------------------------- |
| users                          | Autenticar y atribuir plantillas, schemes y settings |
| structure_templates            | Cabecera y ciclo de vida de cada plantilla           |
| structure_template_nodes       | Árbol reutilizable y defaults de POSITION            |
| schemes                        | Versión de la estructura física y su linaje          |
| locations                      | Árbol físico concreto y secuencia derivada           |
| location_distribution_settings | Defaults y excepciones vigentes por location         |

Las tablas de cargas, corridas, entradas, anchors, rangos y placements no se leen ni
se escriben en 003.

## StructureTemplate

Tabla: structure_templates.

| Campo                  | Uso en 003                         |
| ---------------------- | ---------------------------------- |
| structure_template_id  | Identidad                          |
| name                   | Nombre único                       |
| description            | Explicación opcional               |
| status                 | DRAFT, ACTIVE o ARCHIVED           |
| enabled                | Disponibilidad separada del estado |
| created_by             | Persona administradora creadora    |
| created_at, updated_at | Auditoría temporal                 |

### Transiciones

```text
DRAFT -> ACTIVE -> ARCHIVED
```

- DRAFT permite modificar el árbol.
- ACTIVE permite crear locations si la plantilla y la ruta de nodos están habilitadas.
- ARCHIVED conserva referencias existentes y su uso estructural, pero no permite
  nuevas locations.
- No hay transiciones hacia atrás.
- enabled puede cambiar sin alterar status. Una plantilla deshabilitada conserva sus
  locations, pero no aporta estructura utilizable ni admite otras nuevas.

### Validación para activar

El servicio exige:

1. exactamente una raíz;
2. ausencia de ciclos;
3. al menos una POSITION habilitada alcanzable solo a través de nodos habilitados;
4. roles, defaults, nombres y órdenes válidos.

PostgreSQL ya protege una única raíz, nombres y órdenes entre hermanos, varios checks
de defaults y la prohibición básica de volver de ACTIVE a DRAFT. El servicio aplica el
ciclo completo y la disponibilidad alcanzable.

## StructureTemplateNode

Tabla: structure_template_nodes.

| Campo                      | Regla                                             |
| -------------------------- | ------------------------------------------------- |
| structure_template_node_id | Identidad                                         |
| structure_template_id      | Plantilla propietaria                             |
| parent_template_node_id    | Padre de la misma plantilla; nulo solo en la raíz |
| name                       | Obligatorio; único entre hermanos                 |
| role                       | CONTAINER o POSITION                              |
| sort_order                 | Orden relativo entre hermanos                     |
| visual_kind                | Categoría visual opcional, sin catálogo en 003    |
| default_capacity_value     | Positivo; solo POSITION; inseparable de la unidad |
| default_capacity_unit      | BOOKS, CENTIMETERS o WEIGHT                       |
| default_target_fill_ratio  | Mayor que cero y menor o igual que uno            |
| default_allow_overflow     | Booleano opcional                                 |
| enabled                    | Disponibilidad del nodo y de su rama              |
| created_at, updated_at     | Auditoría temporal                                |

### Relaciones e invariantes

- Un CONTAINER puede tener hijas y no acepta defaults de distribución.
- Una POSITION es hoja y puede aceptar defaults.
- Un nodo no puede moverse a otra plantilla ni bajo uno de sus descendientes.
- Un nodo deshabilitado y toda su descendencia permanecen visibles, pero no pueden
  instanciarse.
- Eliminar un nodo con descendientes en DRAFT elimina el subárbol confirmado dentro de
  una transacción.

## Scheme

Tabla: schemes.

| Campo                  | Uso en 003                             |
| ---------------------- | -------------------------------------- |
| scheme_id              | Identidad                              |
| name                   | Nombre único                           |
| description            | Contexto opcional                      |
| status                 | DRAFT o DEFINED en esta feature        |
| is_active              | Siempre falso en 003                   |
| enabled                | Disponibilidad para una corrida futura |
| based_on_scheme_id     | Origen opcional de una copia           |
| created_by             | Persona administradora creadora        |
| created_at, updated_at | Auditoría temporal                     |

### Transiciones

```text
DRAFT -> DEFINED
```

- DRAFT permite modificar locations y su orden.
- DEFINED vuelve inmutable el árbol y leaf_sequence.
- DISTRIBUTED e is_active pertenecen a funcionalidades posteriores.
- enabled no cambia el estado. Un scheme deshabilitado sigue administrable según su
  estado, pero no puede usarse para crear una corrida.

### Linaje

based_on_scheme_id es opcional, no puede apuntar al propio scheme ni formar ciclos.
Copiar crea una cabecera nueva, habilitada y DRAFT. Copia el árbol, los flags enabled
de las locations, vínculos de mapa y settings; no copia leaf_sequence, corridas ni
resultados.

## Location

Tabla: locations.

| Campo                      | Regla                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| location_id                | Identidad                                                          |
| scheme_id                  | Scheme propietario                                                 |
| structure_template_id      | Plantilla de la instancia                                          |
| structure_template_node_id | Nodo instanciado                                                   |
| parent_location_id         | Padre de la misma instancia; nulo en una raíz                      |
| name                       | Obligatorio; único entre hermanas o raíces                         |
| sort_order                 | Orden entre hermanas; raíces dentro del scheme                     |
| leaf_sequence              | Secuencia global derivada; nula en DRAFT y en ramas no utilizables |
| map_element_id             | Vínculo opcional, único dentro del scheme                          |
| enabled                    | Disponibilidad de la location y su rama                            |
| created_at, updated_at     | Auditoría temporal                                                 |

### Raíces e instancias

No existe una entidad de instancia separada. Cada location raíz instancia la raíz de
una plantilla. Una hija:

- pertenece al mismo scheme y plantilla que su padre;
- instancia el nodo hijo correspondiente;
- queda dentro de la instancia identificada por su ancestro raíz.

Un nodo de plantilla puede repetirse varias veces bajo el mismo padre concreto.

### Disponibilidad efectiva

Una location es utilizable al definir un DRAFT solo cuando:

1. la plantilla está habilitada y su estado es ACTIVE o ARCHIVED;
2. el nodo instanciado y todos sus ancestros de plantilla están habilitados;
3. la location y todos sus ancestros concretos están habilitados.

Solo una POSITION utilizable recibe leaf_sequence. Un CONTAINER nunca la recibe.
El flag enabled del propio scheme no cambia este cálculo: solo controla si el scheme
puede seleccionarse para una corrida futura.

Si después se deshabilita una plantilla usada por un scheme DEFINED, el valor histórico
de leaf_sequence no cambia. La respuesta del scheme indica que no está disponible para
una corrida nueva hasta volver a habilitar la plantilla o preparar otro scheme.
Archivar la plantilla no produce esa exclusión: impide nuevas locations, pero conserva
utilizables las ya existentes.

### Orden y definición

El servicio recibe grupos completos de hermanos y conserva una permutación exacta.
Para definir:

1. valida árbol, estado y disponibilidad;
2. ordena raíces por sort_order;
3. recorre cada grupo de hijas por sort_order en profundidad;
4. asigna 1..N a las POSITION utilizables;
5. deja leaf_sequence nula en los demás nodos;
6. cambia el scheme a DEFINED en la misma transacción.

## LocationDistributionSetting

Tabla: location_distribution_settings.

| Campo                            | Regla                                           |
| -------------------------------- | ----------------------------------------------- |
| location_distribution_setting_id | Identidad                                       |
| location_id, scheme_id           | Location propietaria y coherencia con el scheme |
| capacity_value                   | Positiva; inseparable de capacity_unit          |
| capacity_unit                    | BOOKS, CENTIMETERS o WEIGHT                     |
| target_fill_ratio                | Intervalo (0, 1]                                |
| allow_overflow                   | Booleano opcional                               |
| inherit_to_descendants           | true en CONTAINER; false en POSITION            |
| updated_by                       | Persona responsable del valor vigente           |
| created_at, updated_at           | Auditoría temporal                              |

La fila debe contener al menos uno de los tres aspectos: capacidad con unidad,
target_fill_ratio o allow_overflow. El contrato usa una sustitución completa del
setting: enviar todos los aspectos nulos elimina la fila en lugar de intentar guardar
una configuración vacía.

Los settings pueden cambiar en schemes DRAFT o DEFINED sin cambiar árbol, status ni
leaf_sequence. La precedencia efectiva y su snapshot pertenecen a la creación futura
de una corrida.

## Operaciones compuestas

| Operación         | Garantía transaccional                                      |
| ----------------- | ----------------------------------------------------------- |
| Activar plantilla | Validar árbol y cambiar status juntos                       |
| Mover/reordenar   | Evitar órdenes intermedios duplicados                       |
| Eliminar subárbol | Borrar de hojas a raíz o no borrar nada                     |
| Copiar scheme     | Cabecera, locations y settings completos o ningún resultado |
| Definir scheme    | Validación, leaf_sequence y status juntos                   |
| Guardar setting   | Validación de rol, valores y autoría en una escritura       |

## Garantías del motor y del servicio

| Regla                                          |                 Motor |                         Servicio |
| ---------------------------------------------- | --------------------: | -------------------------------: |
| Tipos enumerados y checks numéricos            |                    Sí | Valida antes para dar error útil |
| Unicidad de nombres, órdenes, mapa y secuencia |                    Sí |                               Sí |
| Llaves compuestas de árbol y settings          |                    Sí |                               Sí |
| POSITION sin hijas                             |               Parcial |                               Sí |
| Ciclos de varios nodos                         |                    No |                               Sí |
| Ruta completa habilitada                       |                    No |                               Sí |
| Transiciones completas                         |               Parcial |                               Sí |
| Inmutabilidad de scheme DEFINED                |                    No |                               Sí |
| DFS y leaf_sequence                            |                    No |                               Sí |
| Copia y borrado atómicos                       | Restricciones básicas |              Sí, con transacción |
| updated_at en cada modificación                |                    No |                               Sí |

## Tipos para Kysely

apps/api/src/database/schema.types.ts se amplía con los cinco tipos de tabla y con los
enumerados SchemeStatus, StructureTemplateStatus, LocationRole y CapacityUnit.

PostgreSQL entrega NUMERIC como texto. Los repositorios convierten capacidad y ratio a
number al construir respuestas y usan valores decimales validados al escribir. Esta
conversión queda en la frontera de persistencia, no en los controladores ni en React.
