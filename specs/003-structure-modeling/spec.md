# Especificación: Modelado de la estructura física

**Feature Branch**: `003-structure-modeling`

**Created**: 2026-07-30

**Status**: Draft

**Input**: Permitir que el personal administrador defina plantillas reutilizables,
cree un `scheme` y modele en él la estructura física completa de la biblioteca,
incluidas sus posiciones, su orden y su configuración previa a cualquier corrida de
distribución.

## Contexto y fuentes

Esta funcionalidad desarrolla las etapas 2 y 3 de
[`docs/flujo.md`](../../docs/flujo.md) y la configuración estructural previa a crear
una corrida. Se apoya en:

- [`docs/decisiones.md`](../../docs/decisiones.md), especialmente las decisiones 1 a
  13 y 28;
- [`docs/problema-distribucion.md`](../../docs/problema-distribucion.md), para las
  diferencias físicas entre posiciones;
- [`docs/db.md`](../../docs/db.md), para las entidades e invariantes ya acordadas.

`docs/dataset.md` fue revisado en el entorno autorizado, pero no aporta evidencia sobre
la estructura física de la biblioteca. `bjff-collection.csv` no fue necesario. Esta
especificación no reproduce contenido ni estadísticas del material privado.

La funcionalidad termina cuando un `scheme` queda estructuralmente definido y sus
ajustes previos están disponibles. No crea corridas, no calcula distribuciones y no
activa un `scheme`.

## Clarifications

### Session 2026-07-30

- Q: ¿Qué debe ocurrir si se deshabilita una plantilla `ACTIVE` que ya tiene
  locations? → A: Se conservan las locations visibles, se impiden nuevas instancias y
  las existentes quedan excluidas del uso estructural.
- Q: ¿Qué debe ocurrir al eliminar un nodo de plantilla o una location que tiene
  descendientes en `DRAFT`? → A: Se muestra el subárbol afectado y se elimina completo
  después de una confirmación explícita.
- Q: ¿Qué debe ocurrir con los nodos deshabilitados cuando una plantilla pasa a
  `ACTIVE`? → A: Permanecen visibles, pero ellos y sus descendientes no pueden
  instanciarse.
- Q: ¿Qué debe significar deshabilitar un `scheme`? → A: Sigue visible y administrable
  según su estado, pero no puede seleccionarse para nuevas corridas mientras esté
  deshabilitado.
- Q: Si se deshabilita una plantilla y un `scheme DEFINED` dependía de sus locations,
  ¿qué debe ocurrir con ese `scheme`? → A: Conserva `DEFINED` y su secuencia; no puede
  usarse para una nueva corrida hasta volver a habilitar la plantilla o crear otro
  `scheme`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Definir una plantilla reutilizable (Priority: P1)

Una persona administradora crea una plantilla en borrador, define su jerarquía con
nombres propios de la biblioteca y establece qué nodos agrupan ubicaciones y cuáles
recibirán libros.

**Why this priority**: las ubicaciones concretas solo pueden modelarse a partir de una
forma válida. La plantilla es el contrato estructural que evita construir árboles
inconsistentes.

**Independent Test**: crear una plantilla con la forma Sección → Cara → Estantería →
Anaquel, marcar Anaquel como `POSITION`, activarla y comprobar que queda disponible
para crear instancias.

**Acceptance Scenarios**:

1. **Given** una sesión administrativa, **When** se crea una plantilla, **Then** queda
   en `DRAFT` y puede editarse.
2. **Given** una plantilla en `DRAFT`, **When** se agregan, renombran o reordenan
   nodos, **Then** el árbol conserva un único nodo raíz y un orden inequívoco entre
   hermanos.
3. **Given** un nodo `POSITION`, **When** se intenta agregarle una hija, **Then** la
   operación se rechaza y la plantilla no cambia.
4. **Given** una plantilla con una raíz y al menos una `POSITION` disponible,
   **When** se activa, **Then** queda en `ACTIVE` y puede instanciarse.
5. **Given** una plantilla incompleta o cíclica, **When** se intenta activar,
   **Then** permanece en `DRAFT` y se informan las condiciones pendientes.
6. **Given** una plantilla `ACTIVE`, **When** se intenta cambiar su jerarquía,
   **Then** la operación se rechaza.
7. **Given** una plantilla activada con una rama deshabilitada, **When** se consulta o
   instancia, **Then** la rama sigue visible para administración, pero ninguno de sus
   nodos está disponible para crear locations.

---

### User Story 2 - Modelar un scheme con estructuras heterogéneas (Priority: P1)

Una persona administradora crea un `scheme` en borrador y representa la biblioteca
mediante una o más instancias de plantillas activas. Puede repetir nodos de plantilla
para reflejar las cantidades físicas reales y combinar formas distintas dentro del
mismo `scheme`.

**Why this priority**: el `scheme` es la versión concreta del espacio sobre el que más
adelante se calculará una distribución.

**Independent Test**: crear un `scheme`, agregar dos secciones con cantidades
distintas desde una plantilla y un archivador desde otra, y comprobar que cada
location respeta la relación padre-hija de su plantilla.

**Acceptance Scenarios**:

1. **Given** una sesión administrativa, **When** se crea un `scheme`, **Then** queda en
   `DRAFT`, habilitado y sin afectar ningún `scheme` existente.
2. **Given** una plantilla `ACTIVE`, **When** se crea una instancia, **Then** la
   location raíz instancia el nodo raíz de esa plantilla.
3. **Given** una instancia en construcción, **When** se agregan hijas, **Then** cada
   hija instancia un nodo hijo válido del nodo utilizado por su padre.
4. **Given** un nodo de plantilla repetible, **When** se crean varias locations desde
   él, **Then** cada una representa un elemento físico distinto con nombre y orden
   propios.
5. **Given** varias plantillas activas, **When** se agregan instancias al mismo
   `scheme`, **Then** las jerarquías conviven sin exigir que tengan la misma forma.
6. **Given** una `POSITION`, **When** se intenta agregarle una hija, **Then** la
   operación se rechaza.

---

### User Story 3 - Ordenar y definir la estructura (Priority: P2)

Una persona administradora ordena raíces y locations hermanas según el recorrido
físico real. Cuando la estructura está completa, solicita validarla y obtiene una
secuencia global de todas las `POSITION` habilitadas.

**Why this priority**: una estructura sin orden global no puede utilizarse como entrada
de una distribución reproducible.

**Independent Test**: modelar un árbol con varias ramas, reordenar dos hermanas,
definir el `scheme` y comprobar que todas las posiciones habilitadas reciben una
secuencia consecutiva acorde con el recorrido en profundidad.

**Acceptance Scenarios**:

1. **Given** un `scheme` en `DRAFT`, **When** se reordenan raíces o hermanas,
   **Then** cambia únicamente el orden dentro de ese grupo.
2. **Given** una estructura válida, **When** se solicita definirla, **Then** el sistema
   recorre raíces e hijas por su orden y asigna `1..N` a las `POSITION` habilitadas.
3. **Given** una location `CONTAINER`, **When** termina la definición, **Then** no
   recibe secuencia global.
4. **Given** una estructura sin posiciones habilitadas, **When** se intenta definir,
   **Then** permanece en `DRAFT`.
5. **Given** una estructura con nombres u órdenes repetidos entre hermanas, **When** se
   intenta guardar o definir, **Then** se rechaza la inconsistencia.
6. **Given** un `scheme` en `DEFINED`, **When** se intenta modificar su árbol,
   **Then** la operación se rechaza y se conserva la versión definida.

---

### User Story 4 - Configurar defaults y excepciones físicas (Priority: P2)

Una persona administradora registra información conocida sobre las posiciones antes
de crear una corrida: capacidad y su unidad, objetivo de llenado y política de overflow.
Puede definir defaults en una `POSITION` de plantilla, heredar valores desde un
`CONTAINER` concreto o ajustar una posición específica.

**Why this priority**: la estructura física no es uniforme. Conservar defaults y
excepciones evita asumir que todas las posiciones reciben la misma cantidad.

**Independent Test**: establecer un default en una plantilla, un ajuste heredable en
un contenedor y una excepción en una posición, y comprobar que los tres quedan
guardados sin crear ninguna corrida.

**Acceptance Scenarios**:

1. **Given** una plantilla en `DRAFT`, **When** se configura un nodo `POSITION`,
   **Then** acepta capacidad, objetivo de llenado y overflow como defaults opcionales.
2. **Given** un nodo `CONTAINER` de plantilla, **When** se intenta asignarle capacidad
   predeterminada, **Then** la operación se rechaza.
3. **Given** una location `CONTAINER`, **When** se configura, **Then** sus valores se
   marcan para heredarse a las `POSITION` descendientes.
4. **Given** una location `POSITION`, **When** se configura, **Then** sus valores se
   aplican únicamente a ella.
5. **Given** una capacidad sin unidad, una capacidad no positiva o un objetivo fuera
   de `(0, 1]`, **When** se intenta guardar, **Then** se rechaza el ajuste.
6. **Given** un `scheme` definido, **When** cambia un ajuste de distribución,
   **Then** la estructura y su secuencia permanecen intactas.

---

### User Story 5 - Preparar una reorganización sin alterar el origen (Priority: P3)

Una persona administradora crea un nuevo `scheme` a partir de otro para preparar una
reorganización. La copia conserva el linaje y parte de la estructura y configuración
existentes, pero puede modificarse de forma independiente.

**Why this priority**: copiar reduce el trabajo de modelar reorganizaciones y mantiene
intacta la versión que sirve de referencia.

**Independent Test**: copiar un `scheme` definido, cambiar una rama en la copia y
comprobar que el origen no cambia y que el nuevo `scheme` conserva la referencia de
linaje.

**Acceptance Scenarios**:

1. **Given** un `scheme` existente, **When** se crea una copia, **Then** el nuevo queda
   en `DRAFT` y registra de cuál se originó.
2. **Given** un `scheme` copiado, **When** termina la operación, **Then** contiene
   copias independientes de sus locations y ajustes.
3. **Given** una copia, **When** se modifica su estructura o configuración, **Then**
   el `scheme` de origen permanece sin cambios.
4. **Given** un linaje que produciría autorreferencia o ciclo, **When** se intenta
   guardar, **Then** la operación se rechaza.

---

### User Story 6 - Retirar plantillas y elementos sin romper historial (Priority: P3)

Una persona administradora archiva una plantilla que ya no debe utilizarse o
deshabilita temporalmente elementos estructurales sin borrar las estructuras que ya
dependen de ellos.

**Why this priority**: el uso normal necesita retirar opciones obsoletas preservando
la trazabilidad de los modelos existentes.

**Independent Test**: archivar una plantilla utilizada, comprobar que sus instancias
siguen consultables y que ya no permite crear otras.

**Acceptance Scenarios**:

1. **Given** una plantilla `ACTIVE`, **When** se archiva, **Then** queda en `ARCHIVED`
   y conserva sus nodos e instancias existentes.
2. **Given** una plantilla `ARCHIVED`, **When** se intenta crear una instancia,
   **Then** la operación se rechaza.
3. **Given** una rama deshabilitada, **When** se define el orden global, **Then** sus
   posiciones descendientes quedan excluidas de la secuencia utilizable.
4. **Given** una location deshabilitada, **When** se consulta el árbol administrativo,
   **Then** sigue visible como elemento retirado y no se confunde con una eliminación.
5. **Given** una plantilla `ACTIVE` con locations existentes, **When** se deshabilita,
   **Then** las locations siguen visibles, quedan fuera del conjunto utilizable y no
   pueden crearse otras desde esa plantilla.
6. **Given** un `scheme` deshabilitado, **When** se administra, **Then** sigue visible
   y admite las operaciones permitidas por su estado, pero no queda disponible para
   crear una corrida.
7. **Given** un `scheme DEFINED` que utiliza una plantilla deshabilitada, **When** se
   consulta, **Then** conserva su estado y secuencia, pero se informa que no está
   disponible para iniciar una corrida.

### Edge Cases

- Plantilla cuyo único nodo es `POSITION`: es válida porque tiene una raíz y una
  posición, y permite modelar una ubicación física sin contenedores.
- Plantilla con varias ramas que terminan en `POSITION`: todas las ramas válidas pueden
  instanciarse.
- Nodo deshabilitado durante el diseño: permanece visible incluso después de activar
  la plantilla, pero él y sus descendientes no pueden instanciarse ni cuentan para
  satisfacer la posición utilizable requerida.
- Intento de mover un nodo o location bajo uno de sus descendientes: se rechaza para
  evitar ciclos.
- Eliminación de un nodo o location con descendientes en un borrador: antes de
  confirmar se muestra el subárbol completo; al confirmar se elimina todo el subárbol
  de forma atómica y, al cancelar, no cambia ningún elemento.
- Dos raíces o hermanas con el mismo nombre u orden: la segunda operación se rechaza.
- Reordenamiento que deja huecos en `sort_order`: se conserva el orden relativo elegido
  por el personal y la secuencia global derivada sigue siendo consecutiva.
- Deshabilitar un `CONTAINER`: su rama completa queda fuera del conjunto de posiciones
  utilizables mientras permanezca deshabilitado.
- `map_element_id` repetido dentro del mismo `scheme`: se rechaza; el identificador
  puede repetirse en otro `scheme`.
- Fallo durante una copia: no queda un `scheme` parcialmente copiado disponible.

## Requirements _(mandatory)_

### Functional Requirements

#### Acceso y consulta

- **FR-001**: El sistema DEBE exigir una sesión administrativa activa para crear,
  modificar, definir, copiar, archivar o deshabilitar elementos estructurales.
- **FR-002**: El sistema DEBE permitir consultar las plantillas y los `scheme` con su
  estado, disponibilidad, autoría, fechas y jerarquía completa.
- **FR-003**: El sistema DEBE presentar los errores de validación indicando el elemento
  y la regla incumplida, sin guardar cambios parciales inválidos.

#### Plantillas

- **FR-004**: El sistema DEBE crear cada plantilla en estado `DRAFT`, con nombre único,
  descripción opcional, autoría y fecha.
- **FR-005**: El sistema DEBE permitir agregar, editar, mover, reordenar, habilitar,
  deshabilitar y eliminar nodos únicamente mientras la plantilla está en `DRAFT`. Si
  un nodo tiene descendientes, DEBE exigir confirmación explícita del subárbol completo
  antes de eliminarlo.
- **FR-006**: El sistema DEBE exigir exactamente un nodo raíz por plantilla antes de
  activarla.
- **FR-007**: Cada nodo de plantilla DEBE tener nombre, rol `CONTAINER` o `POSITION` y
  orden entre hermanos; puede tener una categoría visual opcional.
- **FR-008**: El sistema DEBE impedir nombres y órdenes repetidos entre nodos hermanos.
- **FR-009**: El sistema DEBE impedir ciclos, autorreferencias y relaciones padre-hija
  entre nodos de plantillas distintas.
- **FR-010**: Un nodo `POSITION` NO DEBE tener hijas.
- **FR-011**: El sistema DEBE permitir que una plantilla tenga varias ramas y varias
  hojas `POSITION`.
- **FR-012**: La plantilla DEBE definir relaciones jerárquicas, no cantidades de
  locations concretas.
- **FR-013**: Solo un nodo `POSITION` DEBE aceptar defaults de capacidad, unidad,
  objetivo de llenado y overflow.
- **FR-014**: El sistema DEBE exigir que capacidad y unidad se definan juntas, que la
  capacidad sea positiva y que el objetivo de llenado pertenezca a `(0, 1]`.
- **FR-015**: El sistema DEBE activar únicamente una plantilla con jerarquía válida,
  una raíz y al menos una `POSITION` habilitada y alcanzable únicamente mediante nodos
  habilitados. Los nodos deshabilitados y todos sus descendientes DEBEN seguir visibles
  para administración, pero NO DEBEN poder instanciarse.
- **FR-016**: Una plantilla `ACTIVE` NO DEBE volver a `DRAFT` ni permitir cambios en su
  jerarquía.
- **FR-017**: El sistema DEBE permitir archivar una plantilla `ACTIVE`; una plantilla
  `ARCHIVED` conserva sus instancias existentes y NO DEBE admitir nuevas. Deshabilitar
  una plantilla sin archivarla también DEBE impedir nuevas instancias y excluir sus
  locations existentes del conjunto estructural utilizable, sin modificarlas ni
  eliminarlas. Si un `scheme DEFINED` depende de ellas, DEBE conservar su estado y
  secuencia, pero NO DEBE quedar disponible para una nueva corrida hasta que la
  plantilla vuelva a habilitarse o se prepare otro `scheme`.

#### Schemes y locations

- **FR-018**: El sistema DEBE crear cada `scheme` en `DRAFT`, con nombre único,
  descripción opcional, autoría, fecha y estado habilitado. El sistema DEBE permitir
  habilitarlo o deshabilitarlo sin cambiar su estado estructural; mientras esté
  deshabilitado seguirá visible y administrable según ese estado, pero NO DEBE quedar
  disponible para nuevas corridas.
- **FR-019**: El sistema DEBE permitir modelar un `scheme` con cualquier cantidad de
  instancias provenientes de una o más plantillas `ACTIVE`.
- **FR-020**: Cada location raíz DEBE instanciar el nodo raíz de su plantilla.
- **FR-021**: Cada location hija DEBE instanciar un nodo hijo del nodo utilizado por su
  padre y pertenecer al mismo `scheme` y a la misma instancia de plantilla.
- **FR-022**: El sistema DEBE permitir repetir un nodo de plantilla bajo un mismo padre
  para representar cantidades físicas concretas.
- **FR-023**: Cada location DEBE tener nombre, orden entre hermanas, estado habilitado
  y referencia al nodo de plantilla que determina su rol.
- **FR-024**: El sistema DEBE impedir nombres y órdenes repetidos entre hermanas y
  entre raíces del mismo `scheme`.
- **FR-025**: El sistema DEBE impedir ciclos, autorreferencias, hijas en `POSITION` y
  relaciones que no correspondan a la plantilla.
- **FR-026**: El sistema DEBE permitir agregar, editar, mover, reordenar, habilitar,
  deshabilitar y eliminar locations únicamente mientras el `scheme` está en `DRAFT`.
  Si una location tiene descendientes, DEBE exigir confirmación explícita del subárbol
  completo antes de eliminarlo.
- **FR-027**: Deshabilitar una location `CONTAINER` DEBE excluir también sus
  descendientes del conjunto estructural utilizable, sin borrarlos.
- **FR-028**: El sistema DEBE admitir un `map_element_id` opcional por location y
  garantizar que no se repita dentro del mismo `scheme`.
- **FR-029**: El sistema NO DEBE crear ni modificar mapas SVG; únicamente conserva el
  vínculo opcional indicado en FR-028.

#### Orden y definición

- **FR-030**: `sort_order` DEBE ordenar únicamente locations hermanas; las raíces se
  ordenan dentro del `scheme`.
- **FR-031**: Al definir un `scheme`, el sistema DEBE recorrer las raíces y cada grupo
  de hijas por su orden, en profundidad.
- **FR-032**: El sistema DEBE derivar una secuencia global consecutiva `1..N` para
  todas las `POSITION` utilizables y no debe permitir editarla directamente.
- **FR-033**: Una location `CONTAINER` o una `POSITION` excluida por deshabilitación NO
  DEBE recibir secuencia global.
- **FR-034**: La secuencia global DEBE depender del orden relativo configurado, aunque
  los valores internos usados para ordenar no sean consecutivos; la persona
  administradora no necesita normalizarlos manualmente.
- **FR-035**: El sistema DEBE cambiar un `scheme` de `DRAFT` a `DEFINED` únicamente si
  su árbol es válido y existe al menos una `POSITION` utilizable.
- **FR-036**: Un `scheme` en `DEFINED` NO DEBE permitir cambios estructurales ni volver
  a `DRAFT`; una reorganización se prepara en otro `scheme`.

#### Configuración previa a corridas

- **FR-037**: El sistema DEBE permitir configurar por location capacidad y unidad,
  objetivo de llenado y overflow, con al menos uno de esos aspectos presente.
- **FR-038**: Capacidad y unidad DEBEN definirse juntas, la capacidad DEBE ser positiva
  y el objetivo de llenado DEBE pertenecer a `(0, 1]`.
- **FR-039**: La configuración de un `CONTAINER` DEBE heredarse a sus `POSITION`
  descendientes; la configuración de una `POSITION` DEBE aplicarse únicamente a ella.
- **FR-040**: El sistema DEBE permitir guardar valores parciales porque cada aspecto se
  resolverá por separado al crear una corrida; capacidad y unidad se consideran un
  solo aspecto.
- **FR-041**: El sistema DEBE permitir ajustar la configuración de locations de un
  `scheme` en `DRAFT` o `DEFINED` sin modificar el árbol, su estado estructural ni su
  secuencia global.
- **FR-042**: Esta funcionalidad DEBE conservar los defaults y ajustes vigentes, pero
  NO DEBE resolver ni congelar todavía la configuración efectiva de una corrida.

#### Copia, linaje y atomicidad

- **FR-043**: El sistema DEBE permitir crear un nuevo `scheme` a partir de otro y
  registrar `based_on_scheme_id`.
- **FR-044**: La copia DEBE incluir instancias de plantillas, locations, orden,
  disponibilidad, vínculos de mapa y configuración de locations.
- **FR-045**: El `scheme` copiado DEBE quedar en `DRAFT`, con identidad propia y sin
  compartir filas editables con el origen.
- **FR-046**: Modificar o eliminar la copia NO DEBE alterar el `scheme` de origen.
- **FR-047**: El sistema DEBE impedir autorreferencias y ciclos en el linaje de
  `scheme`.
- **FR-048**: Crear, copiar o definir un `scheme`, recalcular su secuencia global o
  eliminar un subárbol DEBE ser una operación completa: ante un fallo no queda un
  resultado parcial disponible.
- **FR-049**: El sistema DEBE conservar la autoría al crear plantillas y `scheme`, la
  autoría del último ajuste de cada configuración por location y las fechas de creación
  y modificación de los elementos estructurales.

#### Límites de la funcionalidad

- **FR-050**: Esta funcionalidad NO DEBE crear `distribution_runs`,
  `distribution_position_inputs`, anchors, rangos ni placements.
- **FR-051**: Esta funcionalidad NO DEBE calcular una distribución, publicar una
  corrida, cambiar un `scheme` a `DISTRIBUTED` ni activar un `scheme`.
- **FR-052**: La estructura y la configuración DEBEN permanecer separadas de cualquier
  resultado de distribución futuro.

### Key Entities

- **Plantilla de estructura**: forma jerárquica reutilizable. Tiene identidad, nombre,
  descripción, estado `DRAFT`, `ACTIVE` o `ARCHIVED`, disponibilidad, autoría y nodos.
- **Nodo de plantilla**: parte de la forma reutilizable. Tiene padre opcional, nombre,
  rol, orden, categoría visual opcional, disponibilidad y defaults opcionales si es
  `POSITION`.
- **Scheme**: versión completa de la estructura física. Tiene identidad, nombre,
  descripción, estado, disponibilidad, linaje, autoría y un conjunto de locations.
- **Location**: elemento físico concreto dentro de un `scheme`. Instancia un nodo de
  plantilla, tiene padre opcional, nombre, orden, secuencia derivada cuando corresponde,
  vínculo de mapa opcional y disponibilidad.
- **Configuración de location**: ajustes vigentes de capacidad, objetivo de llenado y
  overflow para una location concreta, con herencia obligatoria en contenedores.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Una persona administradora puede crear y activar una plantilla válida
  con al menos cuatro niveles y una `POSITION` sin intervención técnica externa.
- **SC-002**: El 100 % de los intentos de activar plantillas con raíces múltiples,
  ciclos o sin posiciones utilizables se rechaza indicando la causa.
- **SC-003**: Una persona administradora puede modelar en un solo `scheme` al menos
  tres instancias provenientes de dos plantillas distintas y con cantidades diferentes
  de posiciones.
- **SC-004**: Al definir un `scheme`, el 100 % de sus posiciones utilizables recibe
  exactamente una secuencia consecutiva, sin duplicados ni huecos, acorde con el orden
  físico configurado.
- **SC-005**: Reordenar una rama en un borrador produce una secuencia global acorde con
  el nuevo recorrido y conserva intactas la jerarquía y la configuración.
- **SC-006**: El 100 % de las relaciones padre-hija incompatibles, ciclos, nombres
  repetidos y configuraciones fuera de rango se rechaza sin dejar cambios parciales.
- **SC-007**: Copiar un `scheme` conserva el 100 % de sus locations, orden, vínculos y
  ajustes, y modificar la copia produce 0 cambios en el origen.
- **SC-008**: Archivar una plantilla utilizada conserva el 100 % de sus instancias
  existentes y bloquea el 100 % de los intentos de crear otras.
- **SC-009**: Ninguna operación de esta funcionalidad produce corridas, rangos,
  asignaciones ni resultados de distribución.
- **SC-010**: Ninguna operación de modelado es accesible sin sesión administrativa: 0
  accesos concedidos en las pruebas no autenticadas.
- **SC-011**: Una persona administradora puede completar el modelado de referencia
  —dos plantillas, tres instancias y veinte posiciones— y dejarlo en `DEFINED` en menos
  de 15 minutos, sin editar identificadores ni secuencias derivadas manualmente.

## Assumptions

- La autenticación y las cuentas administrativas existentes se reutilizan; la gestión
  de cuentas queda fuera de esta funcionalidad.
- La plantilla define qué relaciones son válidas, pero nunca cuántas locations se
  crean desde cada nodo.
- El orden físico elegido por el personal es un recorrido en profundidad de raíces y
  hermanas ordenadas.
- Deshabilitar un `CONTAINER` excluye temporalmente toda su rama del conjunto
  utilizable, sin eliminarla.
- Una vez `DEFINED`, la estructura de un `scheme` es una versión inmutable. Los
  ajustes de distribución de sus locations tienen un ciclo separado y pueden cambiar
  sin alterar el árbol.
- La configuración efectiva y su precedencia se resolverán y congelarán al crear una
  corrida en una funcionalidad posterior.
- Una copia incluye la estructura y configuración vigentes, pero no contiene ni copia
  corridas o resultados de distribución.
- La interfaz puede ofrecer una representación de árbol y reordenamiento directo,
  siempre que no convierta el orden global derivado en un dato editable.
- `visual_kind` y `map_element_id` son referencias opcionales. El vocabulario visual y
  la creación o edición de mapas no forman parte del alcance.
- No se define borrado normal de plantillas activas, archivadas o `scheme` definidos;
  se utilizan estados y disponibilidad para preservar trazabilidad.

## Fuera de alcance

- Importar, editar o corregir registros de la colección.
- Crear una corrida o elegir una carga de colección para distribuir.
- Resolver la configuración efectiva o crear su snapshot.
- Crear o modificar anchors, rangos o placements.
- Ejecutar, revisar, recalcular o publicar una distribución.
- Cambiar un `scheme` a `DISTRIBUTED` o activarlo.
- Búsqueda pública y presentación de ubicaciones.
- Crear, editar o almacenar mapas SVG.
- Inventario físico confirmado, préstamos, devoluciones y certificación de posiciones.
- Administración de cuentas, recuperación de contraseña o permisos adicionales.
