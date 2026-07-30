# BJFF Book Locator

Localizador de libros para la Biblioteca José Figueres Ferrer del Tecnológico de
Costa Rica.

La persona usuaria introduce un código de clasificación y el sistema muestra
una ubicación física aproximada mediante un mapa esquemático. La búsqueda es
pública. El personal administra la estructura física y las distribuciones desde
un panel autenticado.

## Estado

El proyecto se encuentra en fase de diseño. Todavía no existe una aplicación.

El repositorio contiene la base documental y el modelo de datos que se
utilizarán para definir los requisitos formales con Spec Kit.

## Primera funcionalidad

Incluye:

- importar la colección desde CSV;
- normalizar y ordenar códigos de clasificación;
- modelar estructuras físicas heterogéneas;
- configurar capacidades, pesos y límites conocidos;
- calcular, revisar y publicar distribuciones;
- resolver búsquedas públicas por código.

La ubicación siempre es aproximada. El sistema no confirma la presencia física
de un ejemplar.

Quedan fuera de esta primera funcionalidad:

- la creación y edición de mapas SVG; el modelo solo conserva su vínculo;
- reintentos y bloqueo de inicio de sesión;
- inventario físico confirmado por ejemplar;
- efectos de préstamos y devoluciones;
- distribución intencional de un código en posiciones no consecutivas;
- un proceso definitivo de certificación física.

## Estructura

```text
database/
  01_schema.sql              tipos, tablas, llaves e índices
  02_functions_triggers.sql  funciones y triggers
  03_views.sql               vistas
docs/
  README.md                  índice y responsabilidades documentales
  clasificacion.md           reglas de los códigos de clasificación
  problema-distribucion.md   limitación del reparto físico
  decisiones.md              decisiones y justificación
  flujo.md                   comportamiento de la primera funcionalidad
  db.md                      referencia del modelo de datos
bjff-collection-example.csv  muestra publicable del formato de importación
```

Los siguientes artefactos existen únicamente en entornos autorizados y están
excluidos mediante `.gitignore`:

```text
bjff-collection.csv  exportación oficial de la colección
docs/dataset.md      análisis de la exportación oficial
```

## Material privado y acceso

`bjff-collection.csv` y `docs/dataset.md` son material privado de la Biblioteca
José Figueres Ferrer. No se publican ni deben incluirse en commits, issues,
entregables o redistribuciones del proyecto.

Una persona colaboradora que necesite utilizar la colección real debe contactar
directamente a la persona responsable del repositorio y cumplir las condiciones
de acceso definidas para el proyecto. Entre los requisitos se encuentra ser
asistente de la BJFF o una persona contribuidora oficial autorizada por la
BJFF. La solicitud no implica acceso automático.

Para desarrollo general debe utilizarse `bjff-collection-example.csv`, que solo
documenta el formato de importación y sí puede publicarse.

## Documentación

El punto de entrada es [`docs/README.md`](docs/README.md).

Los documentos definen la base previa a la especificación. El flujo describe el
comportamiento acordado; las decisiones explican su fundamento; los scripts SQL
son la fuente de verdad de la persistencia.

## Base de datos

Requiere PostgreSQL 15 o superior.

Los scripts se ejecutan en orden:

1. `database/01_schema.sql`;
2. `database/02_functions_triggers.sql`;
3. `database/03_views.sql`.

Cada archivo supone que los anteriores ya terminaron correctamente.

## Principios

Las reglas de gobernanza del proyecto están en
[`.specify/memory/constitution.md`](.specify/memory/constitution.md). Prevalecen sobre
cualquier otra práctica y son la referencia para revisar cambios.

- Las plantillas definen formas jerárquicas, no cantidades.
- Solo las ubicaciones `POSITION` reciben distribución.
- Estructura física y distribución tienen ciclos de vida separados.
- La estrategia predeterminada combina estimaciones con límites conocidos.
- Una corrida publicada es inmutable.
- El resultado público siempre se comunica como aproximado.

## Contribución

Todo cambio debe:

- mantener la terminología definida en la documentación;
- actualizar el flujo y las decisiones afectadas;
- actualizar `db.md` junto con los scripts SQL cuando cambie la persistencia;
- conservar el orden determinista de los códigos de clasificación.

## Licencia

Por definir.
