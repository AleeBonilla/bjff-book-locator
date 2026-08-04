# Guía de verificación: Distribución y búsqueda pública

**Fecha**: 2026-08-03 | **Spec**: [spec.md](spec.md)

Esta guía verifica la implementación futura de 004. Usa solo
`bjff-collection-example.csv` y datos sintéticos.

## 1. Preparar el proyecto

```powershell
npm install
npm run db:up
npm run migrate -- up
npm run seed:admin -w apps/api
```

Configurar `.env` a partir de `.env.example`. `MIGRATION_DATABASE_URL` debe usar el rol
propietario del esquema; `DATABASE_URL` conserva el rol de aplicación con privilegios
mínimos. La base de pruebas debe tener aplicada la misma migración antes de ejecutar
integración; el script `pretest` de la implementación debe realizar ese paso mediante
`TEST_DATABASE_URL`.

## 2. Puertas automáticas

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Además de la suite completa, 004 debe incluir y pasar:

- unitarios del resolutor de configuración;
- unitarios de las cinco estrategias, anchors, overflow, división de claves,
  redondeo hacia abajo y cobertura semiabierta;
- integración de creación, recálculo, rollback y revisión;
- dos solicitudes concurrentes que produzcan `RUN_BUSY` o
  `RUN_VERSION_CONFLICT` sin mezclar resultados;
- publicación concurrente y restauración de una versión anterior;
- búsqueda exacta, por rango, sin publicación y sin autenticación;
- coincidencia exacta sin placements que no cae al rango;
- rechazo de todas las rutas administrativas sin sesión;
- rendimiento sintético con 100.000 registros y 1.000 posiciones en menos de 2
  minutos;
- rendimiento sintético con al menos el 95 % de búsquedas públicas en menos de 1
  segundo bajo la carga operativa definida.

## 3. Iniciar la aplicación

```powershell
npm run dev
```

Abrir la URL de Vite. `/buscar` debe ser visible sin sesión. Las rutas de
Importaciones y Esquemas deben redirigir a `/acceso` si no hay una sesión activa.

## 4. Preparar entradas administrativas

1. Iniciar sesión.
2. Importar `bjff-collection-example.csv` y comprobar que la carga termine en `DONE`.
3. Crear o reutilizar una plantilla activa con al menos una `POSITION`.
4. Crear un scheme, instanciar varias posiciones, configurar capacidades y definirlo.
5. Abrir **Esquemas**, luego **Distribuciones**.

No deben aparecer terceras áreas en la navegación principal. Distribuciones es una
subsección de Esquemas.

## 5. Crear y revisar una corrida

Iniciar un cronómetro antes del paso 1. El flujo completo de esta sección y la
publicación de la sección 7 debe terminar en menos de 10 minutos para una corrida
válida, sin contar la preparación de datos de la sección 4.

1. Seleccionar el scheme definido y la carga terminada.
2. Confirmar que `HYBRID` aparece como estrategia predeterminada.
3. Definir defaults y, si corresponde, anchors usando códigos legibles.
4. Calcular.
5. Verificar estado `DONE`, snapshot, rutas, rangos, contadores y advertencias.
6. Ejecutar una búsqueda de prueba desde el detalle.
7. Cambiar un anchor o default y recalcular con la revisión vigente.
8. Confirmar que el detalle vuelve con otra revisión y sustituye toda la vista previa.

La interfaz no debe pedir claves comparables, identificadores internos ni
`leaf_sequence`.

## 6. Verificar conflictos y rollback

1. Abrir la misma corrida en dos ventanas.
2. Recalcular correctamente desde la primera.
3. Intentar guardar desde la segunda.
4. Confirmar que solicita refrescar y no sobrescribe resultados.
5. Provocar en una prueba automatizada un fallo después de iniciar el recálculo.
6. Confirmar que snapshot, anchors, rangos, placements, estado y revisión siguen siendo
   los de la última vista previa válida.

## 7. Publicar

1. Revisar las advertencias.
2. Si hay registros sin asignar, intentar publicar sin la confirmación adicional y
   comprobar que se rechaza mostrando el conteo.
3. Aceptar la vista previa y, cuando corresponda, los no asignados.
4. Publicar.
5. Confirmar que solo esa corrida queda publicada para su scheme y solo su scheme queda
   activo.
6. Volver a publicar una corrida anterior `DONE` y confirmar que sus resultados no se
   modifican.

## 8. Verificar la búsqueda pública

1. Cerrar sesión y abrir `/buscar`.
2. Buscar un código exacto que comparta varios registros y comprobar que devuelve todas
   las rutas distintas sin duplicados.
3. Buscar un código sin coincidencia exacta dentro de un rango.
4. Buscar un código con coincidencia exacta cuyos registros no tengan placements y
   confirmar que responde sin ubicación, sin caer al rango.
5. Probar entrada vacía y un código no interpretable.
6. Confirmar que toda ubicación se presenta como aproximada.
7. Confirmar que no aparecen carga, estrategia, contadores, revisiones, claves
   comparables ni identificadores administrativos.

## 9. Revisión de seguridad y observabilidad

- Las consultas usan Kysely o SQL parametrizado.
- Solo `/api/public/search` queda exenta de sesión.
- Cálculos y publicaciones registran inicio, fin, duración, corrida, conteos y
  desenlace.
- Los logs no contienen códigos de clasificación, títulos, autores, barcodes, rangos,
  cookies ni contenido de filas.
- Ningún test, fixture, captura o documento usa `bjff-collection.csv` o
  `docs/dataset.md`.

## 10. Resultado de verificación del 4 de agosto de 2026

- La suite completa aprobó 213 pruebas y omitió 2 pruebas ajenas a 004.
- La corrida sintética de 100.000 registros y 1.000 posiciones terminó en 1,71
  segundos, por debajo del límite de 2 minutos.
- Las 40 búsquedas públicas concurrentes terminaron en 0,4 segundos y al menos el 95 %
  respondió en menos de 1 segundo.
- Los escenarios automatizados cubrieron creación, cálculo, revisión, recálculo,
  publicación, conflictos, rollback y restauración. El flujo completo terminó muy por
  debajo del límite de 10 minutos.
- La revisión en navegador confirmó acceso público a `/buscar`, redirección
  administrativa a `/acceso`, ausencia de desbordamiento horizontal y una interfaz sin
  flechas tipográficas, guiones largos ni logotipos institucionales.
- Typecheck, lint y build aprobaron. El formato de todos los archivos de 004 aprobó; el
  chequeo global conserva la deuda histórica PA-002 sin ampliar su alcance.
