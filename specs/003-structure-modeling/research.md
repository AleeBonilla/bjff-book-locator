# Investigación: Modelado de la estructura física

**Fecha**: 2026-07-31 | **Spec**: [spec.md](spec.md)

La investigación parte del código existente y de la línea base completa en
database/01_schema.sql. No introduce otro stack ni intenta rediseñar las
funcionalidades 001 y 002.

## 1. Stack y límites de módulos

**Decisión**: conservar el monorepo TypeScript con workspaces de npm, NestJS y Kysely
en apps/api, React con Vite y Tailwind en apps/web, tipos REST compartidos en
packages/api-types y Vitest para pruebas.

La API incorporará dos módulos funcionales: structure-templates y schemes. Cada uno
separa controlador, servicio de dominio y repositorio. Los algoritmos de árbol,
disponibilidad y secuencia vivirán en servicios o funciones puras del backend, nunca
en controladores ni componentes React.

**Motivo**: es la estructura que ya ejecutan 001 y 002. La feature necesita reglas
transaccionales y contratos explícitos, pero no una nueva capa transversal ni otro
workspace.

**Alternativas consideradas**:

- Crear un paquete compartido para árboles: descartado porque hoy solo lo consume la
  API; sería una abstracción anticipada.
- Incorporar un ORM: descartado porque Kysely ya usa el esquema SQL sin apropiárselo.
- Un único módulo structure-modeling: descartado porque plantillas y schemes tienen
  ciclos de vida distintos y cambian por motivos diferentes.

## 2. Persistencia existente

**Decisión**: usar sin cambios de forma las tablas schemes, structure_templates,
structure_template_nodes, locations y location_distribution_settings. No se crean
tablas, columnas ni migraciones en 003.

**Motivo**: database/01_schema.sql ya contiene todos los atributos, tipos enumerados,
índices, checks y llaves requeridos por la especificación. database/02_functions_triggers.sql
protege las invariantes básicas de rol, jerarquía, defaults, estados de plantilla y
settings. docs/db.md asigna expresamente al servicio los ciclos largos, la secuencia
derivada y la disponibilidad efectiva.

El backend ampliará apps/api/src/database/schema.types.ts para describir estas cinco
tablas ante Kysely. Ese archivo no define ni migra el esquema.

**Alternativas consideradas**:

- Añadir una tabla de instancias de plantilla: contradice la decisión 4 de
  docs/decisiones.md; cada location raíz ya identifica una instancia.
- Guardar el árbol como JSON: perdería llaves, unicidad y consultas jerárquicas ya
  modeladas.
- Reescribir la línea base para endurecer todas las reglas: descartado; la constitución
  reserva los cambios posteriores para migraciones y el modelo ya ubica estas reglas
  en el servicio.

## 3. Validaciones y transacciones

**Decisión**: el servicio valida primero el estado y el árbol completo, y ejecuta cada
mutación compuesta en una transacción Kysely.

Son transaccionales como mínimo:

- mover o reordenar hermanos;
- eliminar un subárbol confirmado;
- activar o archivar una plantilla;
- copiar un scheme con sus locations y settings;
- definir un scheme y recalcular leaf_sequence;
- guardar o eliminar settings de una location.

Los ciclos se detectan antes de escribir mediante recorrido por identificadores. Las
restricciones del motor permanecen como segunda barrera y sus errores conocidos se
traducen a códigos del contrato.

**Motivo**: las llaves autorreferentes usan ON DELETE RESTRICT y los órdenes son
únicos entre hermanos. Varias escrituras independientes podrían dejar órdenes
duplicados, copias parciales o árboles incompletos.

**Alternativas consideradas**:

- Confiar solo en errores de PostgreSQL: no ofrece mensajes con el elemento y la regla
  incumplida.
- Guardar cada paso y compensar después: más complejo y contradice la atomicidad de la
  especificación.

## 4. Orden físico y leaf_sequence

**Decisión**: las operaciones de orden reciben la lista completa de identificadores de
un grupo de hermanos. El servicio verifica que sea una permutación exacta y reasigna
sort_order dentro de una transacción. Al definir el scheme, obtiene el árbol completo
y calcula leaf_sequence con un recorrido preorden en profundidad.

Solo reciben secuencia las POSITION cuya ruta completa y cuya plantilla estén
habilitadas. Una plantilla ARCHIVED conserva utilizables sus locations existentes;
solo bloquea crear otras. Las ramas no utilizables conservan leaf_sequence nulo. Los
valores internos de sort_order pueden renumerarse; el contrato solo promete conservar
el orden relativo elegido.

**Motivo**: una lista completa evita empates y actualizaciones ambiguas. Calcular toda
la secuencia al definir es más simple y verificable que intentar ajustar segmentos
incrementalmente.

**Alternativas consideradas**:

- Permitir que el cliente escriba leaf_sequence: descartado porque es un dato derivado.
- Recalcular después de cada edición: trabajo innecesario mientras el scheme sigue en
  DRAFT.
- Actualización incremental: más difícil de demostrar correcta y no aporta valor para
  el volumen administrativo previsto.

## 5. Copia de schemes y borrado de subárboles

**Decisión**: copiar un scheme crea primero la nueva cabecera DRAFT, luego duplica las
locations por niveles manteniendo un mapa de identificadores origen-destino y, al
final, copia los settings con los nuevos identificadores. La operación completa se
revierte ante cualquier fallo.

Para eliminar un subárbol, el backend ofrece primero una vista previa con todos los
elementos afectados. La eliminación confirmada borra de hojas a raíz dentro de una
transacción; los settings desaparecen por la cascada ya definida.

**Motivo**: los identificadores de padres y settings no pueden copiarse literalmente,
y las llaves ON DELETE RESTRICT impiden borrar un padre antes que sus hijas.

**Alternativas consideradas**:

- SQL dinámico específico para clonar todo el grafo: más compacto, pero menos legible
  y más difícil de probar que un mapa explícito.
- Borrar primero el padre y depender de cascada: el esquema usa RESTRICT de forma
  deliberada.

## 6. Contrato REST y representación del árbol

**Decisión**: exponer dos recursos administrativos bajo /api/structure-templates y
/api/schemes. Las respuestas de detalle contienen árboles anidados, mientras que las
mutaciones operan sobre nodos o locations por identificador. Activar, archivar,
copiar, mover, ordenar y definir son acciones explícitas del contrato.

Cada respuesta de scheme incluye disponibilidad derivada para una corrida futura y
las razones que la bloquean. No crea distribution_runs ni resuelve settings efectivos.

**Motivo**: los árboles completos son la forma que necesita el editor; los
identificadores hacen las escrituras pequeñas y auditables. Las acciones explícitas
evitan fingir que las transiciones y copias son simples cambios parciales.

**Alternativas consideradas**:

- Enviar y reemplazar el árbol completo en cada guardado: aumenta el riesgo de
  sobrescribir ramas no editadas y dificulta atribuir errores.
- GraphQL: añade protocolo y herramientas sin un caso que REST no cubra.

## 7. Interfaz de edición

**Decisión**: construir editores de árbol con React y Tailwind existentes, sin una
biblioteca nueva de componentes ni de drag-and-drop. Reordenar se ofrece con botones
accesibles de subir y bajar; el arrastre nativo del navegador puede actuar como atajo
de puntero sobre la misma operación y nunca será el único mecanismo.

Las confirmaciones de subárbol muestran nombre, rol y cantidad de descendientes antes
de habilitar la acción destructiva.

**Motivo**: el panel apunta a navegadores modernos de escritorio. Los controles
nativos cubren teclado, foco y lectores de pantalla, y evitan una dependencia para un
solo patrón.

**Alternativas consideradas**:

- Incorporar una biblioteca de drag-and-drop: se difiere hasta que exista otro caso o
  requisitos de interacción que el mecanismo nativo no cubra.
- Arrastre como único mecanismo: no es accesible por teclado.

## 8. Estrategia de pruebas y escala

**Decisión**: usar Vitest y Supertest como en 001. Las funciones puras de ciclo,
disponibilidad y DFS tendrán pruebas unitarias. Los contratos, transiciones,
restricciones, copias y atomicidad tendrán pruebas de integración contra bjff_test,
en serie y limpiando las tablas antes de cada caso.

La referencia de diseño es un panel de baja concurrencia, decenas de plantillas y
hasta 1 000 locations por scheme sin imponer un límite funcional. A esa escala, cargar
un árbol, copiarlo o definirlo debe terminar en menos de 2 segundos en el entorno local
de integración. El objetivo de experiencia sigue siendo SC-011: completar el modelo
de veinte posiciones en menos de quince minutos.

**Motivo**: las propiedades importantes dependen de PostgreSQL, en especial índices
únicos, llaves compuestas y transacciones. Mil locations dan margen sobre el escenario
de aceptación sin diseñar para una escala que no existe.

**Alternativas consideradas**:

- Base simulada: no verifica las garantías que sostienen el árbol.
- Pruebas de navegador nuevas: se difieren; el dominio y el contrato quedan cubiertos
  en API y el flujo visible se valida con quickstart.md.

## Resultado

No quedan incógnitas técnicas pendientes. La implementación puede realizarse con el
stack y el esquema actuales, sin datos privados y sin invadir corridas ni distribución.
