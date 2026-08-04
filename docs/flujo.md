# Flujo del sistema

## 1. Propósito

El sistema localiza libros de la Biblioteca José Figueres Ferrer mediante su
código de clasificación.

La persona usuaria escribe un código y recibe una ubicación física aproximada.
El personal administra la colección, la estructura de la biblioteca y la
distribución desde un panel autenticado.

La ubicación siempre es aproximada. El sistema no confirma la presencia física
de un ejemplar.

## 2. Alcance de la primera funcionalidad

Incluye:

- importar el catálogo desde CSV;
- normalizar y ordenar códigos de clasificación;
- definir plantillas de estructura;
- construir una biblioteca con estructuras heterogéneas;
- ordenar todas las posiciones físicas;
- configurar capacidades, pesos y límites conocidos;
- calcular, revisar y publicar distribuciones;
- responder búsquedas públicas.

No incluye:

- creación y edición de mapas SVG; el modelo solo conserva `map_element_id`
  para vincular la ubicación con un mapa posterior;
- reintentos o bloqueo de inicio de sesión;
- inventario físico confirmado por ejemplar;
- efecto de préstamos y devoluciones;
- distribución intencional de un código en posiciones no consecutivas;
- un proceso definitivo de certificación física.

## 3. Conceptos

### `scheme`

Representa una versión completa de la estructura física de la biblioteca.

Un cambio estructural se prepara en otro `scheme`. `based_on_scheme_id` registra
de cuál se copió, pero la copia la ejecuta la aplicación.

Estados:

```text
DRAFT -> DEFINED -> DISTRIBUTED
```

Solo un `scheme` puede estar activo.

### Plantilla de estructura

Describe una forma jerárquica reutilizable. Define relaciones, no cantidades.

```text
Sección
└── Cara
    └── Estantería
        └── Anaquel
```

Dos secciones con distinta cantidad de caras, estanterías o anaqueles pueden
usar la misma plantilla.

### Roles de nodo

Cada nodo de plantilla tiene uno de estos roles:

| Rol         | Función                  |
| ----------- | ------------------------ |
| `CONTAINER` | Agrupa otras ubicaciones |
| `POSITION`  | Recibe distribución      |

Los nombres visibles son configurables. Una `POSITION` puede llamarse Anaquel,
Cajón, Estantería u otro término.

Una `POSITION` no puede tener hijos. Una plantilla puede tener varias ramas
terminadas en `POSITION`.

### `location`

Es un elemento físico concreto.

Una location raíz que utiliza una plantilla representa una instancia de esa
plantilla:

```text
Plantilla: Sección -> Cara -> Estantería -> Anaquel

Instancia 1: Sección A
Instancia 2: Sección B
```

Las cantidades existen únicamente en las locations.

### Corrida de distribución

Un `distribution_run` relaciona:

- un `scheme`;
- una carga de colección;
- una estrategia;
- una secuencia de posiciones;
- una configuración resuelta;
- límites manuales;
- rangos y asignaciones calculados.

Cada corrida es una versión independiente.

## 4. Flujo general

```text
[1. Importar colección] ─────────────────┐
                                         ├─> [4. Crear corrida]
[2. Definir plantillas] ──> [3. Modelar] ┘
                                                ↓
                                     [5. Configurar y calcular]
                                                ↓
                                     [6. Revisar y recalcular]
                                                ↓
                                     [7. Publicar y activar]
                                                ↓
                                       [8. Búsqueda pública]
```

La importación y el modelado son independientes.

### Navegación administrativa

La interfaz administrativa agrupa el trabajo en dos áreas principales:

- **Importaciones**, con una subsección para importar archivos y otra para consultar el
  historial y sus resultados.
- **Esquemas**, con una subsección para esquemas físicos y otra para las plantillas que
  estos utilizan.

Al modelar una jerarquía, la relación con el padre se selecciona de forma explícita.
Desde un contenedor también se puede iniciar directamente la creación de sus hijas. En
un esquema físico se pueden crear varias instancias consecutivas en una sola acción,
usando un nombre base y numeración automática.

## 5. Importar la colección

### Precondiciones

- Archivo CSV disponible.
- Usuario administrador autenticado.

### Lectura

1. Crear un `collection_load` en `PENDING`.
2. Leer el archivo como UTF-8 y descartar el BOM.
3. Procesar punto y coma y comillas con una biblioteca CSV.
4. Descartar la fila vacía y el pie `TOTAL;n`.
5. Comparar `n` con las filas leídas.
6. Recortar espacios de relleno.

### Normalización

Para cada código:

1. conservar el valor original en `classification_raw`;
2. convertir coma decimal en punto;
3. separar prefijo, número DDC y Cutter;
4. retirar espacios y separadores internos no canónicos del número DDC;
5. normalizar espacios y guiones del Cutter;
6. retirar el indicador de edición DDC solo cuando existe Cutter;
7. convertir la clave a mayúsculas;
8. guardar el resultado en `comparable_key`.

Las columnas de clave utilizan `COLLATE "C"`.

### Resultado

Cada fila legible crea un registro en `books`.

- Un código vacío produce `comparable_key = NULL`.
- Un caso ambiguo se importa y se marca `REVIEW`.
- Solo una fila ilegible se marca `REJECTED`.
- El código de barras no es único dentro de una carga.

La carga termina en `DONE` o `ERROR`.

## 6. Definir plantillas

### Crear una plantilla

1. Crear `structure_templates` en `DRAFT`.
2. Crear un único nodo raíz.
3. Agregar nodos hijos.
4. Asignar a cada nodo un nombre y un rol.
5. Definir su orden predeterminado entre nodos hermanos.
6. Configurar defaults de distribución solo en nodos `POSITION`.
7. Activar la plantilla.

Ejemplos:

```text
Plantilla A
Sección (CONTAINER)
└── Cara (CONTAINER)
    └── Estantería (CONTAINER)
        └── Anaquel (POSITION)

Plantilla B
Estantería (CONTAINER)
└── Cara (CONTAINER)
    └── Anaquel (POSITION)

Plantilla C
Archivador (CONTAINER)
└── Cajón (POSITION)
```

La plantilla no fija cuántas locations se deben crear.

### Validaciones

- Una plantilla tiene un solo nodo raíz.
- Una `POSITION` no admite hijos.
- Los nombres y órdenes son únicos entre nodos hermanos.
- Los defaults de capacidad pertenecen a nodos `POSITION`.
- Una plantilla activa tiene al menos una `POSITION`.

Estados:

```text
DRAFT -> ACTIVE -> ARCHIVED
```

Solo `DRAFT` permite modificar nodos. `ACTIVE` permite crear nuevas
instancias. `ARCHIVED` conserva estructuras existentes, pero no admite nuevas.

En `DRAFT`, eliminar un nodo con descendientes exige mostrar el subárbol completo y
confirmar su eliminación atómica. Un nodo deshabilitado permanece visible; si la
plantilla se activa, ni ese nodo ni sus descendientes pueden instanciarse.

Deshabilitar una plantilla `ACTIVE` impide nuevas instancias y excluye del uso
estructural sus locations existentes sin modificarlas. Un `scheme DEFINED` que ya la
utiliza conserva su estado y secuencia, pero no puede iniciar otra corrida hasta
volver a habilitar la plantilla o preparar otro `scheme`.

## 7. Modelar un `scheme`

### Crear la estructura

1. Crear el `scheme` en `DRAFT`.
2. Elegir una plantilla.
3. Crear una location raíz como instancia.
4. Crear las locations hijas necesarias.
5. Repetir nodos de plantilla según la cantidad física existente.
6. Agregar otras instancias, incluso de plantillas diferentes.

En `DRAFT`, eliminar una location con descendientes exige mostrar el subárbol completo,
confirmar la operación y eliminarlo de forma atómica.

Ejemplo:

```text
Sección A                    Plantilla A
├── Cara frontal
│   ├── Estantería 1
│   │   ├── Anaquel 1
│   │   └── Anaquel 2
│   └── Estantería 2
│       └── Anaquel 1
└── Cara posterior
    └── Estantería 1
        └── Anaquel 1

Sección B                    Plantilla A
└── Cara frontal
    └── Estantería 1
        └── Anaquel 1

Estantería triangular       Plantilla B
└── Cara A
    └── Anaquel 1
```

### Orden físico

`sort_order` se interpreta únicamente entre locations hermanas.

- Las raíces se ordenan dentro del `scheme`.
- Cada `CONTAINER` ordena sus hijos.
- La interfaz permite reordenar mediante arrastre.

El sistema recorre el árbol en profundidad y asigna `leaf_sequence = 1..N` a
todas las `POSITION`.

`leaf_sequence` es derivado; no se edita directamente.

### Validaciones

- Una raíz instancia el nodo raíz de su plantilla.
- Cada hija instancia un nodo hijo del nodo usado por su padre.
- Una `POSITION` no tiene hijas.
- Nombres y órdenes son únicos entre hermanas.
- Toda `POSITION` habilitada recibe una secuencia global.
- Debe existir al menos una `POSITION` habilitada.

Si pasa las validaciones, el `scheme` cambia a `DEFINED`.

Deshabilitar un `scheme` no cambia su estado. Permanece visible y administrable según
las reglas de ese estado, pero no puede seleccionarse para una nueva corrida mientras
esté deshabilitado.

## 8. Configurar la distribución

### Niveles de configuración

La configuración efectiva se resuelve por campo, desde el valor más específico:

```text
1. Location POSITION
2. Ancestro más cercano con inherit_to_descendants = true
3. Nodo POSITION de la plantilla
4. Default de la corrida
```

Los valores posibles son:

- `capacity_value`;
- `capacity_unit`;
- `target_fill_ratio`;
- `allow_overflow`.

`capacity_value` y `capacity_unit` se resuelven como una unidad.

### Unidades

| Unidad        | Interpretación                        |
| ------------- | ------------------------------------- |
| `BOOKS`       | Capacidad aproximada en registros     |
| `CENTIMETERS` | Longitud útil usada proporcionalmente |
| `WEIGHT`      | Peso relativo                         |

Sin grosor por libro, `CENTIMETERS` no representa ocupación exacta.

Una corrida no mezcla unidades incomparables. Todas sus posiciones deben
resolverse en la misma unidad.

### `target_fill_ratio`

Define la fracción que se intenta usar:

```text
capacidad = 40 BOOKS
target_fill_ratio = 0.85
objetivo = 34 registros
```

Con `WEIGHT` o `CENTIMETERS`, multiplica el peso efectivo.

### `allow_overflow`

Indica si una posición puede superar su objetivo para mantener unido un grupo de
códigos.

- `true`: permite el exceso y genera advertencia.
- `false`: intenta la siguiente posición o divide el grupo si no existe otra
  solución.

## 9. Crear una corrida

### Precondiciones

- `scheme` en `DEFINED` o `DISTRIBUTED`;
- `collection_load` en `DONE`;
- al menos una `POSITION`;
- estrategia seleccionada.

### Creación

1. Crear `distribution_runs` en `PENDING`.
2. Elegir estrategia.
3. Validar las entradas exigidas por la estrategia.
4. Resolver todas las `POSITION` habilitadas.
5. Copiar su orden y configuración efectiva a
   `distribution_position_inputs`.
6. Guardar en `resolution` el origen de cada valor.
7. Registrar límites conocidos, si la estrategia los admite.

`distribution_position_inputs` congela la entrada de la corrida. Cambios
posteriores en plantillas o locations no alteran el historial.

### Estrategias

| Estrategia | Entrada requerida                                  | Anchors       | Cálculo                                                     |
| ---------- | -------------------------------------------------- | ------------- | ----------------------------------------------------------- |
| `CAPACITY` | Capacidad `BOOKS` para cada posición               | No permitidos | Llena posiciones en orden según su objetivo                 |
| `WEIGHTED` | `WEIGHT` o `CENTIMETERS` compatibles               | No permitidos | Reparte proporcionalmente según el peso efectivo            |
| `ANCHORED` | Un anchor para cada posición después de la primera | Requeridos    | Las fronteras conocidas determinan los rangos               |
| `HYBRID`   | Capacidades o pesos compatibles                    | Opcionales    | Respeta anchors parciales y calcula los tramos desconocidos |
| `MANUAL`   | Cobertura completa de rangos                       | No permitidos | Valida rangos introducidos y deriva placements              |

La estrategia predeterminada es `HYBRID`.

La estrategia controla las validaciones y el algoritmo; no modifica el
`scheme`, las locations ni la colección.

#### `CAPACITY`

- Todas las posiciones deben resolverse en `BOOKS`.
- El objetivo es `capacity_value * target_fill_ratio`.
- `allow_overflow` controla si un grupo puede superar el objetivo.
- Los resultados calculados usan `source = AUTO`.

#### `WEIGHTED`

- Todas las posiciones deben resolverse en una misma unidad: `WEIGHT` o
  `CENTIMETERS`.
- La proporción se calcula con la capacidad efectiva de cada posición.
- `allow_overflow` se aplica al ajustar fronteras entre grupos.
- Los resultados calculados usan `source = AUTO`.

#### `ANCHORED`

- La primera posición comienza en el límite inferior global.
- Cada posición posterior debe tener un anchor.
- Las capacidades son informativas y pueden generar advertencias, pero no
  desplazan una frontera conocida.
- Los resultados usan `source = ANCHORED`.

Un conjunto parcial de anchors no corresponde a `ANCHORED`; corresponde a
`HYBRID`.

#### `HYBRID`

- Todas las posiciones deben tener capacidades o pesos compatibles.
- Puede ejecutarse sin anchors.
- Cada anchor divide la secuencia en segmentos independientes.
- El algoritmo distribuye cada segmento sin mover sus fronteras conocidas.
- Los resultados pueden combinar `AUTO` y `ANCHORED`.

#### `MANUAL`

- El personal introduce una cobertura completa, ordenada y sin solapamientos.
- Las capacidades son informativas y no cambian los rangos.
- Los `book_placements` se derivan de los rangos.
- Los resultados usan `source = MANUAL`.

Una combinación inválida se rechaza antes del cálculo. El sistema no ignora
anchors ni capacidades silenciosamente.

## 10. Límites conocidos

Un anchor significa:

> Esta `POSITION` comienza en este código.

Ejemplo:

```text
Sección B / primer anaquel comienza en 600
```

Se guarda:

```text
location_id = primer anaquel de Sección B
boundary_key = 600
```

El inicio de esa posición es el final exclusivo del tramo anterior. No se
registran anchors `START` y `END` separados.

### Validaciones

- El anchor pertenece a una `POSITION` de la corrida.
- Una posición tiene como máximo un anchor.
- Los anchors avanzan en el mismo orden que `position_sequence`.
- Sus claves avanzan en orden de clasificación.
- No dejan segmentos sin posiciones.
- No se mueven automáticamente para satisfacer capacidades.

Los anchors son entradas de `ANCHORED` y `HYBRID`. Los rangos calculados son
resultados. En `MANUAL`, los intervalos propuestos por el personal se consideran
resultados solo después de validar su cobertura y derivar los placements.

## 11. Calcular una corrida híbrida

### Preparación

1. Obtener las posiciones por `position_sequence`.
2. Obtener libros con `comparable_key`.
3. Ordenarlos por la clave con `COLLATE "C"`.
4. Agrupar registros con la misma clave.
5. Validar unidades, anchors y capacidades.

### Segmentación por anchors

Los anchors dividen posiciones y colección:

```text
Posiciones 1..3       códigos menores que 600
Posiciones 4..5       códigos desde 600 hasta antes de 800
Posiciones 6..N       códigos desde 800
```

Cada segmento se distribuye de forma independiente.

### Reparto

Con `BOOKS`:

```text
objetivo = capacity_value * target_fill_ratio
```

Con `WEIGHT` o `CENTIMETERS`:

```text
peso efectivo = capacity_value * target_fill_ratio
proporción = peso efectivo / suma de pesos del segmento
```

El algoritmo:

1. calcula objetivos por posición;
2. asigna grupos en orden;
3. evita dividir una clave cuando sea posible;
4. pasa a la siguiente posición si el grupo no cabe;
5. si un grupo supera todas las posiciones disponibles:
   - lo mantiene unido con advertencia cuando se permite overflow;
   - de lo contrario, lo divide entre posiciones consecutivas;
6. nunca cambia un anchor;
7. registra libros sin asignar si las restricciones son incompatibles.

Para esta versión, cualquier cambio recalcula la corrida completa.

### Salidas

La corrida escribe:

- `book_placements`;
- `distribution_ranges`;
- conteos e incidencias;
- estado `DONE` o `ERROR`.

Todo el cálculo ocurre en una transacción.

## 12. `book_placements`

Registra una asignación por registro de la colección:

```text
distribution_run + book + POSITION
```

Cada `book_id` aparece como máximo una vez por corrida. Un registro representa
un solo ejemplar o fila de la carga y no puede ocupar dos posiciones
simultáneamente.

La multiplicidad pertenece al código de clasificación. Varios registros con la
misma `comparable_key` pueden asignarse a posiciones consecutivas:

```text
book 1, clave 658.4 -> POSITION 12
book 2, clave 658.4 -> POSITION 12
book 3, clave 658.4 -> POSITION 13
```

Permite:

- contar registros por posición;
- mostrar varias posiciones para una misma clave;
- conservar asignaciones por corrida;
- soportar en el futuro ubicaciones no consecutivas.

`allow_overflow` intenta mantener unido el grupo que comparte una clave. No
asigna varias posiciones a un mismo `book_id`. Si el grupo no cabe completo,
sus registros pueden dividirse entre posiciones consecutivas.

No representa una confirmación física.

## 13. `distribution_ranges`

Registra intervalos aproximados:

```text
[range_start_key, range_end_key)
```

La pertenencia es:

```text
range_start_key <= clave < range_end_key
```

La cobertura usa:

- cadena vacía como inicio global;
- `~` como final global.

Los rangos de una corrida deben formar una cobertura ordenada, continua y sin
solapamientos.

Si una clave ocupa posiciones consecutivas:

- `book_placements` conserva todas las posiciones;
- el rango abre en la primera;
- las posiciones de continuación pueden tener placements sin rango propio.

`source` indica:

- `AUTO`: calculado sin límite manual;
- `ANCHORED`: frontera derivada de un anchor;
- `MANUAL`: estrategia manual.

## 14. Revisar y recalcular

El panel muestra:

- registros sin asignar;
- posiciones vacías;
- posiciones sobrecargadas;
- claves divididas;
- anchors aplicados;
- rangos generados;
- diferencias frente a la corrida base;
- búsquedas de prueba.

### Corrida no publicada

Puede editarse como borrador:

1. cambiar defaults o settings;
2. agregar, mover o eliminar anchors;
3. marcar la corrida `PENDING`;
4. reconstruir `distribution_position_inputs` si cambió la configuración;
5. eliminar resultados anteriores;
6. recalcular;
7. mostrar la nueva vista previa.

No se modifica un rango aislado. Un ajuste de frontera crea o modifica un
anchor y recalcula resultados coherentes.

### Corrida publicada

Es inmutable.

Para corregirla:

1. crear otra corrida;
2. establecer `based_on_distribution_run_id`;
3. copiar estrategia, parámetros, defaults, anchors y entradas manuales
   aplicables;
4. elegir la carga de colección;
5. volver a resolver la configuración vigente;
6. crear otro `distribution_position_inputs`;
7. aplicar cambios;
8. calcular y revisar;
9. sustituir la publicada en una transacción.

`based_on_distribution_run_id` registra linaje. No copia filas automáticamente,
no comparte resultados y no reutiliza el snapshot anterior. La corrida derivada
pertenece al mismo `scheme`, pero puede usar otra `collection_load`.

No se copian `book_placements` ni rangos calculados. En una corrida `MANUAL`, se
pueden copiar los rangos introducidos como entradas editables antes de volver a
validarlos.

`reviewed_by`, `reviewed_at` y `review_notes` registran una revisión eventual.
No convierten el resultado público en exacto.

## 15. Publicar y activar

### Precondiciones

- corrida en `DONE`;
- `scheme` en `DISTRIBUTED`;
- vista previa aceptada;
- sin errores bloqueantes.

### Publicación

1. Despublicar la corrida anterior del mismo `scheme`, si existe.
2. Publicar la nueva corrida.
3. Activar el `scheme`, si corresponde.
4. Confirmar todo en una transacción.

Solo puede existir:

- un `scheme` activo;
- una corrida publicada por `scheme`.

Las consultas concurrentes continúan viendo el estado anterior hasta el commit.

## 16. Búsqueda pública

1. Recibir el código.
2. Generar `comparable_key`.
3. Obtener el `scheme` activo.
4. Obtener su corrida publicada.
5. Buscar coincidencias exactas en la carga de esa corrida.
6. Si existen, consultar sus `book_placements` y agrupar las `POSITION`
   distintas.
7. Si no existen, consultar `distribution_ranges`.
8. Mostrar una o varias ubicaciones aproximadas.

Una coincidencia exacta en catálogo es más específica, pero no confirma que el
ejemplar esté físicamente presente.

Una clave puede devolver varias posiciones porque distintos registros con ese
código pueden haberse distribuido entre ubicaciones consecutivas. Esto no
significa que un mismo ejemplar ocupe varias posiciones.

## 17. Mantenimiento

| Situación                 | Acción                                                |
| ------------------------- | ----------------------------------------------------- |
| Cambia la colección       | Crear carga y corrida nuevas                          |
| Cambian pesos o anchors   | Crear o recalcular corrida                            |
| Cambia la estructura      | Copiar o crear otro `scheme`                          |
| Cambia una plantilla      | Crear otra plantilla y aplicarla en un nuevo `scheme` |
| Volver a una distribución | Publicar una corrida anterior                         |
| Volver a una estructura   | Reactivar un `scheme` anterior                        |

## 18. Invariantes

- El público solo consulta una corrida publicada.
- Una corrida publicada está en `DONE`.
- Un `scheme` activo está en `DISTRIBUTED`.
- Las plantillas definen forma, no cantidades.
- Solo `POSITION` participa en distribución.
- El orden global se deriva del árbol concreto.
- Cada estrategia exige y admite entradas diferentes.
- Los anchors son restricciones manuales.
- Los rangos y placements son resultados.
- Cada `book_id` tiene como máximo un placement por corrida.
- Una `comparable_key` puede abarcar varias posiciones consecutivas.
- Ningún resultado algorítmico se presenta como ubicación confirmada.
