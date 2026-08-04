# Puesta en marcha y validación: Modelado de la estructura física

**Fecha**: 2026-07-31 | **Spec**: [spec.md](spec.md) | **Contrato**:
[contracts/rest-api.md](contracts/rest-api.md)

Esta guía valida 003 de extremo a extremo. No contiene implementación ni requiere
material privado de la BJFF.

## Requisitos previos

- Node.js 20 o superior
- Docker con Compose
- Puertos 5432, 3000 y 5173 disponibles

## 1. Base de datos

```bash
docker compose up -d db
```

La línea base aplica en orden database/01_schema.sql, 02_functions_triggers.sql y
03_views.sql. 003 no agrega migraciones.

Comprobar las tablas utilizadas:

```bash
docker compose exec db psql -U bjff -d bjff -c "\dt schemes"
docker compose exec db psql -U bjff -d bjff -c "\dt structure_templates"
docker compose exec db psql -U bjff -d bjff -c "\dt structure_template_nodes"
docker compose exec db psql -U bjff -d bjff -c "\dt locations"
docker compose exec db psql -U bjff -d bjff -c "\dt location_distribution_settings"
```

Si el volumen se creó con una línea base anterior, recrearlo:

```bash
docker compose down -v
docker compose up -d db
```

Esta operación elimina la base local de desarrollo.

## 2. Configuración y dependencias

```bash
cp .env.example .env
npm install
```

DATABASE_URL debe apuntar a bjff con el rol de aplicación. TEST_DATABASE_URL debe
apuntar a bjff_test. Las pruebas vacían tablas y abortan si la base de pruebas no
termina en _test.

## 3. Cuenta administrativa

Configurar las variables SEED_ADMIN_* en .env y ejecutar:

```bash
npm run seed:admin -w apps/api
```

No existe registro público de cuentas.

## 4. Ejecución

```bash
npm run dev
```

- API: http://localhost:3000
- Panel: http://localhost:5173

Todas las rutas de 003 deben redirigir al acceso o responder 401 sin sesión.

## Verificación automatizada

Ejecutar la matriz completa:

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

La cobertura de 003 debe incluir:

| Nivel         | Evidencia                                                            |
| ------------- | -------------------------------------------------------------------- |
| Unitario      | Ciclos, disponibilidad de ramas, permutaciones y DFS                 |
| Integración   | Contratos REST, estados, llaves, checks y errores traducidos         |
| Transaccional | Copia, definición, reordenamiento y borrado sin resultados parciales |
| Seguridad     | Todas las rutas rechazan sesiones ausentes                           |
| Privacidad    | Ninguna prueba usa dataset.md ni bjff-collection.csv                 |

Las pruebas de integración se ejecutan en serie contra PostgreSQL real, igual que 001
y 002.

## Escenario de referencia

Medir el tiempo desde que se inicia el modelado hasta dejar el scheme en DEFINED. El
objetivo es menos de quince minutos.

### 1. Plantillas

Crear y activar:

1. Plantilla A: Sección → Cara → Estantería → Anaquel.
2. Plantilla B: Archivador → Cajón.

Comprobar:

- ambas empiezan en DRAFT;
- Anaquel y Cajón tienen rol POSITION;
- un default de 40 BOOKS y targetFillRatio 0.85 se acepta en Anaquel;
- el mismo default se rechaza en un CONTAINER;
- al activarlas quedan ACTIVE e inmutables.

### 2. Scheme heterogéneo

Crear un scheme DRAFT con tres raíces:

1. Sección A desde la plantilla A;
2. Sección B desde la plantilla A, con otra cantidad de hijas;
3. Archivador principal desde la plantilla B.

Crear veinte POSITION en total. Verificar que repetir un nodo de plantilla produce
locations distintas y que una hija incompatible se rechaza.

### 3. Orden y definición

Reordenar raíces y hermanas, primero con botones de teclado y luego con arrastre si
está disponible.

Definir el scheme y comprobar:

- status pasa a DEFINED;
- todas las POSITION utilizables reciben exactamente 1..20;
- el recorrido coincide con raíces e hijas ordenadas en profundidad;
- CONTAINER y ramas deshabilitadas no reciben leafSequence;
- el árbol ya no admite cambios estructurales.

### 4. Settings

Configurar:

- targetFillRatio heredable en un CONTAINER;
- capacidad con unidad en una POSITION;
- allowOverflow en otra POSITION.

Comprobar que el servidor deriva inheritToDescendants según el rol. Modificar un
setting después de DEFINED no debe cambiar status, árbol ni leafSequence. Eliminar
todos los valores debe retirar la fila de settings.

## Casos de fallo obligatorios

| Acción                                       | Resultado esperado                |
| -------------------------------------------- | --------------------------------- |
| Activar una plantilla sin raíz               | 422 INVALID_TEMPLATE_TREE         |
| Activar sin POSITION habilitada y alcanzable | 422 INVALID_TEMPLATE_TREE         |
| Agregar una hija a POSITION                  | 422 INVALID_PARENT                |
| Mover bajo un descendiente                   | 422 TREE_CYCLE                    |
| Reordenar con lista incompleta o repetida    | 422 ORDER_MISMATCH                |
| Duplicar nombre entre hermanas               | 409 SIBLING_NAME_CONFLICT         |
| Duplicar mapElementId en un scheme           | 409 MAP_ELEMENT_CONFLICT          |
| Editar árbol de plantilla ACTIVE             | 409 TEMPLATE_NOT_EDITABLE         |
| Editar árbol de scheme DEFINED               | 409 SCHEME_NOT_EDITABLE           |
| Borrar subárbol sin confirmación             | 409 SUBTREE_CONFIRMATION_REQUIRED |
| Guardar capacidad sin unidad                 | 422 INVALID_DISTRIBUTION_SETTINGS |
| Definir sin POSITION utilizable              | 422 INVALID_SCHEME_TREE           |

Después de cada fallo, releer el detalle y comprobar que no quedó un cambio parcial.

## Disponibilidad e historial

### Plantilla y nodos

1. Activar una plantilla con una rama deshabilitada.
2. Comprobar que la rama sigue visible pero no puede instanciarse.
3. Crear un scheme DEFINED que use una plantilla habilitada.
4. Deshabilitar la plantilla.
5. Comprobar que las locations y leafSequence siguen visibles, pero
   availableForNewRun es false.
6. Volver a habilitar la plantilla y comprobar que la disponibilidad se restaura.
7. Archivar una plantilla habilitada que ya tenga locations y comprobar que bloquea
   otras nuevas sin retirar las existentes del uso.

### Scheme

Deshabilitar un scheme DRAFT y verificar que aún puede editarse y definirse. Después
de DEFINED debe conservarse administrable, pero availableForNewRun permanece false
hasta volver a habilitarlo.

## Copia y eliminación atómicas

### Copia

Copiar el scheme de referencia:

- el nuevo scheme queda DRAFT y habilitado;
- basedOnSchemeId apunta al origen;
- conserva locations, orden, flags, mapElementId y settings;
- leafSequence queda nula;
- cambiar la copia no modifica el origen.

Forzar un fallo de integración durante la copia debe dejar cero schemes parciales.

### Eliminación

En un DRAFT, pedir la vista previa de un CONTAINER con descendientes. Debe listar todo
el subárbol. Cancelar no modifica nada; confirmar elimina raíz, descendientes y sus
settings en una única operación.

## Rendimiento de diseño

La prueba de rendimiento se ejecuta separada:

```bash
PERF=1 npx vitest run --project api test/integration/structure-performance.spec.ts
```

Con un scheme sintético de 1 000 locations, cada operación de cargar, copiar o definir
el árbol debe terminar en menos de 2 segundos en el entorno local de integración. El
archivo sintético solo contiene nombres estructurales inventados.

## Cierre

La validación termina con:

- dos plantillas ACTIVE;
- un scheme DEFINED con secuencia consecutiva;
- settings editables sin crear una corrida;
- cero registros nuevos en distribution_runs, distribution_position_inputs,
  distribution_anchors, distribution_ranges y book_placements.
