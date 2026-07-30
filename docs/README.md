# Índice de documentación

## Propósito

Esta carpeta contiene la base documental previa a la especificación formal del
sistema.

Cada archivo tiene una responsabilidad distinta. Las definiciones deben
mantenerse en el documento correspondiente para evitar reglas duplicadas o
contradictorias.

## Orden de lectura

| Documento | Responsabilidad |
|---|---|
| [`clasificacion.md`](clasificacion.md) | Define la estructura, normalización y orden de los códigos de clasificación. |
| `dataset.md` *(privado)* | Describe la colección oficial analizada y la calidad de sus datos. Solo está disponible en entornos autorizados. |
| [`problema-distribucion.md`](problema-distribucion.md) | Explica por qué la colección no puede repartirse en bloques fijos y qué limitaciones debe considerar la solución. |
| [`decisiones.md`](decisiones.md) | Registra las decisiones de diseño, su motivo y sus consecuencias. |
| [`flujo.md`](flujo.md) | Define el comportamiento esperado y el flujo completo de la primera funcionalidad. |
| [`db.md`](db.md) | Explica el modelo de persistencia, sus tablas, campos, relaciones y validaciones. |

Para preparar especificaciones, el orden recomendado es:

1. reglas de clasificación;
2. evidencia del dataset, cuando se cuente con acceso autorizado;
3. problema de distribución;
4. decisiones de diseño;
5. flujo funcional;
6. modelo de datos.

## Fuentes de verdad

| Tema | Fuente |
|---|---|
| Interpretación y orden de códigos | `clasificacion.md` |
| Hechos observados en la colección | `dataset.md` |
| Limitación física del reparto | `problema-distribucion.md` |
| Comportamiento funcional acordado | `flujo.md` |
| Motivos de las decisiones | `decisiones.md` |
| Estructura efectiva de PostgreSQL | `database/*.sql` |
| Explicación del modelo de datos | `db.md` |

El SQL es la fuente de verdad para la estructura implementada de la base de
datos. `db.md` debe explicar esa estructura sin reemplazarla.

## Material privado

`dataset.md` y `../bjff-collection.csv` son material privado de la Biblioteca
José Figueres Ferrer y están excluidos del repositorio.

Quien necesite utilizar la colección real debe contactar directamente a la
persona responsable del repositorio y cumplir las condiciones de acceso. Entre
ellas se encuentra ser asistente de la BJFF o una persona contribuidora oficial
autorizada por la BJFF. El acceso debe aprobarse antes de recibir cualquiera de
los dos archivos.

La muestra `../bjff-collection-example.csv` es el único archivo de colección
destinado a documentación y desarrollo público.

## Responsabilidades

### `clasificacion.md`

Es normativo para convertir un código recibido en una clave comparable. No
describe búsquedas, distribución ni persistencia.

### `dataset.md`

Es descriptivo y está vinculado a la fecha y archivo indicados. No convierte
patrones observados en reglas generales sin justificación adicional.

### `problema-distribucion.md`

Define la incertidumbre física y las condiciones del problema. No sustituye el
flujo ni prescribe todos los detalles del algoritmo.

### `decisiones.md`

Explica por qué se eligió el diseño actual. No debe convertirse en una secuencia
operativa ni repetir el diccionario de la base de datos.

### `flujo.md`

Es la referencia funcional para obtener requisitos y escenarios. Debe indicar
precondiciones, acciones, validaciones, estados y resultados.

### `db.md`

Documenta la persistencia y distingue las garantías de PostgreSQL de las reglas
que debe implementar el servicio.

## Reglas de mantenimiento

- Usar siempre el término **códigos de clasificación**.
- Usar enlaces Markdown estándar para relacionar documentos.
- Mantener una sola responsabilidad principal por archivo.
- Actualizar `flujo.md` cuando cambie el comportamiento esperado.
- Actualizar `decisiones.md` cuando cambie el motivo o el criterio de diseño.
- Actualizar `db.md` y los scripts SQL en el mismo cambio cuando se modifique la
  persistencia.
- Actualizar `dataset.md` solo después de volver a analizar el archivo indicado.
- Registrar como pendiente cualquier punto que todavía no sea una decisión.
