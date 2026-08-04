---
name: track-open-questions
description: Registra y mantiene incertidumbres, supuestos no confirmados, riesgos diferidos y decisiones pendientes en docs/preguntas-abiertas.md. Usar al detectar información material que falta, contradicciones, dependencias externas, criterios de aceptación ambiguos o asuntos pospuestos que podrían reaparecer como errores o inconvenientes. No usar para fallos ya diagnosticados ni tareas claramente definidas.
---

# Registrar preguntas abiertas

Conservar las incertidumbres materiales hasta que se resuelvan, sin convertirlas
silenciosamente en supuestos.

## Flujo

1. Leer `docs/README.md`, `docs/preguntas-abiertas.md` si existe y los artefactos
   relacionados.
2. Confirmar que el punto está realmente abierto y que su impacto es material.
3. Buscar duplicados por pregunta, contexto y archivos afectados.
4. Si el archivo no existe, crearlo con una breve explicación y una sección
   `## Preguntas`.
5. Crear o actualizar una entrada con el siguiente identificador `PA-NNN`:

```markdown
### PA-NNN — Título breve

- **Estado:** ABIERTA | BLOQUEADA | RESUELTA | DESCARTADA
- **Detectada:** YYYY-MM-DD
- **Contexto:** dónde apareció.
- **Pregunta:** qué falta decidir o confirmar.
- **Impacto:** qué puede fallar o quedar bloqueado.
- **Siguiente paso:** acción concreta para resolverla.
- **Responsable:** persona o rol, solo si se conoce.
- **Relacionada con:** enlaces a archivos, requisitos o decisiones.
```

6. No inventar responsable, fecha límite ni respuesta.
7. Al resolverla, no borrar la entrada: cambiar el estado, añadir `Resolución` y la
   fecha. Si la respuesta establece una decisión importante, usar `$record-decisions`
   y enlazarla.
8. Actualizar o cerrar entradas que la tarea actual haya resuelto.
9. Revisar el diff para evitar duplicados, datos sensibles y preguntas vagas sin
   siguiente paso.

## Qué no registrar

No registrar errores con causa conocida, tareas ya descritas en `tasks.md`, ideas sin
impacto identificable ni dudas que puedan resolverse leyendo el repositorio.
