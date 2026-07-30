# Especificación: Gestión de cargas y revisión de registros

**Feature Branch**: `002-load-management`

**Created**: 2026-07-30

**Status**: Draft

**Input**: La persona administradora puede eliminar cargas desde el panel y recorrer
todos los registros de una carga por páginas. Los títulos no deben mostrar la
puntuación catalográfica final.

## Contexto y fuentes

Esta funcionalidad continúa [`001-collection-import`](../001-collection-import/spec.md),
que ya importa la colección y permite consultarla. Aquí se corrigen tres límites que
aparecieron al usarla con el catálogo completo, y se incorpora la eliminación de cargas.

Fuentes previas: [`docs/flujo.md`](../../docs/flujo.md),
[`docs/db.md`](../../docs/db.md), [`docs/decisiones.md`](../../docs/decisiones.md).

`bjff-collection.csv` y `docs/dataset.md` son material privado de la BJFF. Los
escenarios reproducibles usan `bjff-collection-example.csv`.

## Decisión que esta funcionalidad revierte

La especificación 001 excluyó explícitamente la eliminación de cargas: **FR-041a**
obligaba a conservarlas todas como historial, y la sección «Fuera de alcance» lo
registraba como decisión, no como omisión.

El uso real cambió el criterio. Durante la puesta en marcha se acumulan cargas de
prueba y de archivos equivocados, y sin forma de retirarlas el listado deja de ser
utilizable. La funcionalidad no está publicando nada todavía, así que ninguna carga
sostiene un resultado visible al público.

**FR-041a de la especificación 001 queda derogado por FR-001 de esta.** El historial
sigue siendo el valor por omisión: se conserva salvo que alguien decida lo contrario de
forma explícita.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Eliminar una carga (Priority: P1)

Una persona administradora identifica una carga que ya no sirve —un archivo
equivocado, una prueba— y la elimina desde el panel junto con todos sus registros y
problemas.

**Why this priority**: es lo que hoy no se puede hacer y vuelve inmanejable el
listado. Las otras historias mejoran una consulta que ya funciona.

**Independent Test**: importar el archivo de ejemplo, eliminar la carga resultante y
comprobar que desaparece del listado y que no quedan registros ni problemas suyos.

**Acceptance Scenarios**:

1. **Given** una sesión activa y una carga existente, **When** se solicita eliminarla,
   **Then** la carga deja de existir y desaparece del listado.
2. **Given** una carga eliminada, **When** se consultan sus registros o sus problemas,
   **Then** no queda ninguno.
3. **Given** una carga cualquiera, **When** se solicita eliminarla desde el panel,
   **Then** el sistema pide confirmación indicando cuántos registros se perderán, y no
   elimina nada hasta obtenerla.
4. **Given** una carga inexistente, **When** se solicita eliminarla, **Then** se
   responde que no existe y no se altera ninguna otra carga.
5. **Given** varias cargas, **When** se elimina una, **Then** las demás conservan
   íntegros sus registros, sus problemas y sus contadores.
6. **Given** ninguna sesión activa, **When** se intenta eliminar una carga, **Then** el
   acceso se rechaza y la carga permanece.
7. **Given** una carga utilizada por una corrida de distribución, **When** se solicita
   eliminarla, **Then** se rechaza explicando que está en uso, y la carga permanece.

---

### User Story 2 - Recorrer todos los registros por páginas (Priority: P2)

Una persona administradora abre los registros de una carga y los recorre completos,
de cien en cien, sabiendo en qué página está y cuántas hay.

**Why this priority**: hoy la vista muestra un tope y el resto de la colección es
inalcanzable desde el panel. Sin esto, revisar una carga real es imposible.

**Independent Test**: importar el archivo de ejemplo y comprobar que se puede llegar
hasta el último registro avanzando de página en página, sin repeticiones ni saltos.

**Acceptance Scenarios**:

1. **Given** una carga con más registros que el tamaño de página, **When** se abre la
   vista de registros, **Then** se muestran los primeros 100 y se indica el total.
2. **Given** una página cualquiera, **When** se avanza a la siguiente, **Then** se
   muestran los 100 registros siguientes en orden de fila de origen, sin repetir
   ninguno de la anterior.
3. **Given** la última página, **When** se consulta, **Then** contiene los registros
   restantes y no se ofrece avanzar más.
4. **Given** la primera página, **When** se consulta, **Then** no se ofrece retroceder.
5. **Given** cualquier página, **When** se consulta, **Then** se indica el número de
   página actual y el total de páginas.
6. **Given** una carga sin registros, **When** se abre la vista, **Then** se informa
   que no hay registros y no se ofrece navegación.
7. **Given** el filtro de registros sin clave comparable activo, **When** se recorren
   las páginas, **Then** la paginación se aplica sobre el subconjunto filtrado.

---

### ~~User Story 3 - Ver autor y año de cada registro~~ (Retirada)

**Retirada por decisión de la persona responsable del proyecto**, antes de cerrar la
funcionalidad. El listado de registros no muestra autor ni año.

Los datos siguen importándose y guardándose, y el contrato REST los sigue entregando en
`Registro`, definido por [`001-collection-import`](../001-collection-import/spec.md).
Lo retirado es únicamente mostrarlos en el panel. Si más adelante se quieren, no hace
falta ni migración ni reimportación: es añadir las columnas a la vista.

---

### User Story 4 - Títulos sin puntuación catalográfica final (Priority: P3)

Los títulos se muestran sin los signos que el sistema de origen añade al final para
separar las áreas de la descripción bibliográfica.

**Why this priority**: la mayoría de los títulos de la colección terminan en `:` o `/`,
lo que ensucia toda vista que los muestre.

**Independent Test**: listar registros cuyo título termine en esos signos y comprobar
que se muestran sin ellos, y que el valor almacenado no cambió.

**Acceptance Scenarios**:

1. **Given** un título terminado en `:`, **When** se muestra, **Then** aparece sin ese
   signo ni el espacio que lo precede.
2. **Given** un título terminado en `/` o en `=`, **When** se muestra, **Then** aparece
   sin ese signo ni el espacio que lo precede.
3. **Given** un título terminado en varios signos encadenados como `… : /`, **When**
   se muestra, **Then** aparece sin ninguno de ellos.
4. **Given** un título sin puntuación final, **When** se muestra, **Then** aparece
   intacto.
5. **Given** un título terminado en `.`, **When** se muestra, **Then** aparece intacto,
   porque el punto también cierra abreviaturas y su recorte no tiene lectura única.
6. **Given** cualquier título, **When** se consulta el registro almacenado, **Then**
   conserva el valor tal como se importó.
7. **Given** un título compuesto solo por puntuación, **When** se muestra, **Then** se
   trata como título ausente en lugar de quedar vacío.

---

### Edge Cases

**Eliminación**

- Eliminar una carga en estado `ERROR` o `PENDING`: se permite igual; ninguna expone
  registros utilizables.
- Eliminar la única carga existente: el listado queda vacío e invita a importar.
- Dos solicitudes de eliminación de la misma carga: la segunda informa que no existe,
  sin error inesperado.
- Carga con decenas de miles de registros: la eliminación es una sola operación y no
  deja registros huérfanos.

**Paginación**

- Total exactamente divisible por el tamaño de página: no aparece una última página
  vacía.
- Página solicitada más allá del total: se muestra un resultado vacío sin error.
- Registros añadidos o eliminados entre dos páginas: el recorrido no garantiza una
  instantánea; el orden por fila de origen mantiene el resultado estable.

**Presentación**

- Título con espacios de relleno antes del signo final: se recortan junto con él.
- Signo de puntuación en el interior del título, como `Redes : teoría` o `a = b`: se
  conserva. La regla solo alcanza el final.

## Requirements *(mandatory)*

### Eliminación de cargas

- **FR-001**: El sistema DEBE permitir a una persona administradora eliminar una carga
  de colección, con sus registros y sus problemas.
- **FR-002**: El sistema DEBE exigir una confirmación explícita antes de eliminar,
  indicando cuántos registros se perderán. La eliminación no es reversible.
- **FR-003**: El sistema DEBE eliminar la carga y todo lo suyo como una sola operación:
  no puede quedar un registro ni un problema sin su carga.
- **FR-004**: El sistema NO DEBE alterar ninguna otra carga al eliminar una.
- **FR-005**: El sistema DEBE rechazar la eliminación de una carga utilizada por una
  corrida de distribución, explicando que está en uso. Esa restricción ya la garantiza
  el modelo de datos.
- **FR-006**: El sistema DEBE responder que la carga no existe cuando se solicite
  eliminar una ausente, sin tratarlo como fallo inesperado.
- **FR-007**: El sistema DEBE exigir sesión activa para eliminar, como para toda
  función administrativa.
- **FR-008**: El sistema DEBE registrar la eliminación de forma estructurada, con el
  identificador de la carga y el número de registros retirados, y sin contenido de la
  colección.

### Paginación de registros

- **FR-009**: El sistema DEBE permitir recorrer todos los registros de una carga en
  páginas de 100.
- **FR-010**: El sistema DEBE ordenar los registros por número de fila de origen, de
  modo que el recorrido sea estable y sin repeticiones.
- **FR-011**: El sistema DEBE informar el total de registros y la página actual dentro
  del total de páginas.
- **FR-012**: El sistema NO DEBE ofrecer retroceder desde la primera página ni avanzar
  desde la última.
- **FR-013**: El sistema DEBE aplicar la paginación sobre el subconjunto filtrado
  cuando haya un filtro activo, y no sobre el total de la carga.
- **FR-014**: El sistema DEBE devolver un resultado vacío, sin error, cuando se pida
  una página posterior a la última.

### Presentación de los registros

- **FR-015**: ~~El sistema DEBE mostrar el autor y el año de cada registro cuando
  existan.~~ **Retirado** junto con la historia 3.
- **FR-016**: El sistema DEBE distinguir un dato ausente de uno vacío al presentarlo.
- **FR-017**: El sistema DEBE mostrar los títulos sin la puntuación catalográfica final
  `:`, `/` y `=`, junto con los espacios que la preceden. La secuencia puede repetirse
  —`… : /` y `… / :` aparecen en la colección—, y debe retirarse entera.
- **FR-018**: El sistema NO DEBE recortar un punto final del título: el punto también
  cierra abreviaturas y su recorte no tiene una sola lectura.
- **FR-019**: El sistema DEBE conservar el título tal como se importó. El recorte es de
  presentación y no altera el dato almacenado.
- **FR-020**: El sistema DEBE tratar como título ausente el que quede vacío tras el
  recorte.

## Key Entities

Esta funcionalidad no introduce entidades. Usa las de
[`001-collection-import`](../001-collection-import/data-model.md): la carga de
colección, el registro y el problema de carga.

La eliminación de una carga arrastra sus registros y sus problemas, tal como ya define
el modelo en `database/01_schema.sql`. Ningún cambio de persistencia es necesario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras eliminar una carga, quedan 0 registros y 0 problemas suyos, y las
  demás cargas conservan sus contadores sin variación.
- **SC-002**: Una persona administradora alcanza el último registro de una carga de
  10 000 filas recorriendo páginas, sin repeticiones ni omisiones: la unión de las
  páginas equivale al total exacto.
- **SC-003**: Cada página de registros muestra como máximo 100 filas.
- **SC-004**: Ninguna función de eliminación es accesible sin sesión activa: 0 accesos
  concedidos en las pruebas de acceso no autenticado.
- **SC-005**: Ningún título mostrado termina en `:`, `/` o `=`, y el 100% de los títulos
  almacenados conserva su valor original.
- **SC-006**: ~~El 100% de los registros con autor y año los muestra en el listado.~~
  **Retirado** junto con la historia 3.
- **SC-007**: Toda eliminación deja un registro estructurado con el identificador de la
  carga y el número de registros retirados.

## Assumptions

- La eliminación es definitiva y no se ofrece papelera ni deshacer. Añadirlos sería
  complejidad sin un caso que la pida; la confirmación previa es la salvaguarda.
- El tamaño de página es de 100 registros, fijado por el encargo. No se ofrece
  configurarlo.
- El listado de registros muestra fila, código de barras, clasificación original, clave
  comparable y título. Autor y año quedaron fuera al retirarse la historia 3.
- El recorte de títulos cubre `:`, `/` y `=`: los tres signos de puntuación
  catalográfica final presentes en la colección. Los dos primeros aparecen de forma
  masiva; el tercero, en pocos registros.
- El recorrido por páginas no ofrece una instantánea consistente: si la carga cambia
  mientras se recorre, el resultado puede variar. El orden por fila de origen lo hace
  suficientemente estable para revisar.

## Fuera de alcance

- Papelera, deshacer o recuperación de cargas eliminadas.
- Eliminación de registros o problemas individuales.
- Edición de cualquier dato de la colección desde el panel.
- Búsqueda o filtrado de registros por texto.
- Exportación de registros.
- Todo lo excluido por [`001-collection-import`](../001-collection-import/spec.md):
  plantillas, esquemas, distribuciones, publicación, búsqueda pública y administración
  de cuentas.
