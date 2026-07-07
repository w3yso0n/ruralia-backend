# Ruralia — SESIÓN 09: Formularios dinámicos (Etapa 1)

> **Fecha:** 7 de julio de 2026
> **Alcance:** Backend (roles + endpoints faltantes) y frontend (interfaz de administración) sobre el módulo `formularios` existente

---

## Contexto y objetivo

Se retoma el módulo `formularios` creado en la sesión 05 (backend), que hasta ahora solo tenía consumidores pensados para el flujo de captura en campo (mobile). El objetivo de esta iniciativa es dar a los administradores una **interfaz web para diseñar plantillas de formulario totalmente personalizadas**, sin acoplar todavía la plantilla a un usuario/proyecto/actividad específico de captura — esa asignación queda para la Etapa 2.

**Alcance definido con el usuario:**
- Etapa 1 (esta sesión): esquema de datos + interfaz de administración para crear/editar plantillas.
- Etapa 2 (futura, documentada aquí para contexto): sincronización y asignación de plantillas a usuarios/proyectos/actividades para uso en mobile, captura de respuestas y procesamiento de datos.

---

## Decisión de diseño: reutilizar el módulo existente

Se evaluó crear un módulo nuevo en paralelo vs. extender el existente (`PlantillaFormulario` → `subactividad` obligatoria, sesión 05). Se decidió **extender el módulo existente** en vez de duplicar conceptos.

**Nota — decisión revisada en la misma sesión (ver "Addendum: plantilla independiente" más abajo):** inicialmente se mantuvo la relación `subactividad` obligatoria tal como estaba en la sesión 05, asumiendo que se abriría después. Al probar el flujo real se detectó que esto impedía exactamente lo que el usuario pidió al inicio (crear una plantilla sin proyecto, y reutilizarla en N proyectos) — se corrigió en el mismo día, ver addendum.

Modelo final:

```
PlantillaFormulario ←→ Subactividad   (N:N, tabla plantilla_formulario_subactividades, ambos lados opcionales)
PlantillaFormulario → CampoFormulario
Jornada → EnvioFormulario → RespuestaFormulario
```

---

## Cambios en backend

### 1. Roles en endpoints de escritura

Ninguno de los endpoints de `/formularios/plantillas` tenía `@Roles(...)` (a diferencia de otros módulos como `proyectos`). Se agregó `@Roles(RolEnum.ADMINISTRADOR)` a:

- `POST /formularios/plantillas`
- `PATCH /formularios/plantillas/:id` (nuevo)
- `POST /formularios/plantillas/:id/publicar`
- `POST /formularios/plantillas/:id/clonar`

Los `GET` quedan sin restricción de rol (cualquier usuario autenticado puede listar/ver plantillas — necesario para que mobile las consuma en la Etapa 2).

### 2. Endpoints nuevos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/formularios/plantillas` | Lista todas las plantillas (para el panel de administración) |
| `GET` | `/formularios/plantillas/:id` | Detalle de una plantilla con sus campos |
| `PATCH` | `/formularios/plantillas/:id` | Edita nombre/descripción/subactividad y reemplaza el conjunto de campos |

**Importante sobre el orden de rutas:** `GET /plantillas/:id` se registró **después** de `GET /plantillas/subactividad/:subactividadId` en el controller — Nest resuelve rutas en el orden de declaración, así que si `:id` fuera antes, capturaría por error las llamadas a `/plantillas/subactividad/...`.

### 3. Lógica de `actualizar()` en `PlantillasFormularioService`

Reemplazo de conjunto de campos por diffing dentro de una transacción:
- Campos del payload sin `id` → se crean.
- Campos del payload con `id` → se actualizan (`manager.save`, no `manager.update`, porque `update()` con columnas JSONB parciales falla en TypeORM — ver nota de compilación abajo).
- Campos existentes en la plantilla que no vienen en el payload → se eliminan.

Esto permite que el frontend simplemente envíe la lista completa de campos deseada tal como quedó en el builder, sin necesidad de trackear altas/bajas por separado.

### 4. Nota técnica: `manager.update` vs `manager.save` con JSONB

`manager.update(Entidad, id, { columnaJsonb: objeto | null })` falla en tiempo de compilación con TypeORM cuando el tipo de la columna es `Record<string, unknown> | null` — el `QueryDeepPartialEntity` no admite ese tipo para `update()`. Se resolvió usando `manager.save(Entidad, { id, ...datos })` en su lugar, que sí acepta el tipo directamente.

### 5. DTOs y respuesta expuestos

- `ActualizarPlantillaFormularioDto` / `ActualizarCampoFormularioDto` (nuevos, en `dto/formulario.dto.ts`) — todos los campos opcionales, `campos[].id` opcional (ausente = campo nuevo).
- `RespuestaPlantillaFormularioDto` ahora expone `subactividadId` (vía `@Transform(({ obj }) => obj.subactividad?.id)`, porque `plainToInstance` con `excludeExtraneousValues` no sigue relaciones anidadas automáticamente) y `RespuestaCampoFormularioDto` ahora expone `opciones` y `reglasValidacion` (antes no viajaban a la respuesta, indispensables para que el builder pueda precargar un campo de selección al editar).
- El servicio ahora siempre carga `relations: { campos: true, subactividad: true }` en las tres consultas de lectura (`obtenerPlantilla`, `listarPorSubactividad`, `listarTodas`) para que `subactividadId` nunca venga `undefined`.

---

## Cambios en frontend

Nueva sección **"Formularios"** en el panel, visible solo para `ADMINISTRADOR` (entrada en `Sidebar` con `soloAdmin: true`, mismo patrón que "Usuarios").

### Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `app/(panel)/formularios/page.tsx` | Listado de plantillas |
| `app/(panel)/formularios/nuevo/page.tsx` | Crear plantilla |
| `app/(panel)/formularios/[id]/page.tsx` | Editar plantilla |
| `components/formularios/gestion-formularios.tsx` | Tabla de plantillas + acciones publicar/clonar |
| `components/formularios/editor-plantilla-formulario.tsx` | Builder visual de campos |

### Tipos y API (`lib/types.ts`, `lib/api.ts`)

Nuevos tipos: `PlantillaFormulario`, `CampoFormulario`, `TipoCampoFormulario`, `CrearPlantillaFormularioPayload`, `ActualizarPlantillaFormularioPayload`, `CampoFormularioPayload`.

Nuevas funciones: `listarPlantillasFormulario`, `obtenerPlantillaFormulario`, `crearPlantillaFormulario`, `actualizarPlantillaFormulario`, `publicarPlantillaFormulario`, `clonarPlantillaFormulario`.

### Selector de subactividad: ver addendum

La versión inicial de esta sección (selector encadenado Proyecto → Subactividad, obligatorio para guardar) fue reemplazada en la misma sesión por una selección múltiple opcional — ver "Addendum: plantilla independiente" más abajo para el diseño final. No existe (ni se creó) un endpoint que liste todas las subactividades de todos los proyectos de una vez; el frontend resuelve esto iterando `listarProyectos` + `obtenerPlanProyecto` por cada uno al cargar el builder.

### Builder visual de campos (`editor-plantilla-formulario.tsx`)

Por campo se puede editar: etiqueta, clave (autogenerada por slug desde la etiqueta, editable), tipo (los 10 valores de `TipoCampo`), si es obligatorio, y — solo para `SELECCION_UNICA`/`SELECCION_MULTIPLE` — una lista de opciones (un textarea de una opción por línea, serializado a `{ valores: string[] }` en `opciones`). Los campos se pueden reordenar (↑/↓) y eliminar; el orden final se recalcula al guardar según la posición en el array. Al editar una plantilla existente, se reconstruye el estado del formulario a partir de `GET /formularios/plantillas/:id`, incluyendo localizar cuál proyecto contiene la subactividad asignada (se itera `listarProyectos` + `obtenerPlanProyecto` hasta encontrar coincidencia) para preseleccionar ambos selectores.

Al guardar, se llama `crearPlantillaFormulario` o `actualizarPlantillaFormulario` según haya o no `plantillaId`, y se redirige al listado.

---

## Verificación realizada

- `tsc --noEmit` limpio en backend y frontend (el único error preexistente en `test/app.e2e-spec.ts` es de tipos de `supertest`, no relacionado).
- Backend levantado en modo `start:dev`: las rutas nuevas (`GET /plantillas`, `GET /plantillas/:id`, `PATCH /plantillas/:id`) se registran en el orden correcto, sin colisión con `GET /plantillas/subactividad/:subactividadId`.
- Frontend levantado en dev: `/formularios` y `/formularios/nuevo` responden 200.
- **Pendiente de verificación manual por el usuario**: flujo completo en navegador (crear plantilla con campo de selección, publicar, clonar) — no se pudo probar con automatización de navegador en esta sesión por falta de conexión de la extensión de Chrome.

---

## Addendum: plantilla independiente (N:N con Subactividad)

Tras completar la versión inicial (subactividad obligatoria, 1 plantilla = 1 subactividad), el usuario preguntó explícitamente si un formulario podía crearse sin proyecto y reutilizarse en varios — la respuesta con el diseño inicial era no. Se corrigió el modelo en la misma sesión:

### Cambio de modelo

- `PlantillaFormulario.subactividad` (`ManyToOne`, obligatoria) → `PlantillaFormulario.subactividades` (`ManyToMany`, opcional, tabla intermedia `plantilla_formulario_subactividades`).
- Crear una plantilla **ya no requiere ningún proyecto/subactividad**. `CrearPlantillaFormularioDto.subactividadIds` es un array opcional.
- Una misma plantilla puede asignarse a **N subactividades de N proyectos distintos** sin duplicar su definición de campos.
- Nuevo endpoint dedicado: `PATCH /formularios/plantillas/:id/subactividades` (`AsignarSubactividadesDto { subactividadIds: string[] }`) — reemplaza el conjunto completo de asignaciones, para usarse después de crear/publicar la plantilla sin tener que reenviar todos los campos.
- `clonar()` dejó de recibir `nuevaSubactividadId` — ahora simplemente duplica la plantilla (nombre, descripción, campos) **sin subactividades asignadas**; asignarlas es un paso aparte con el endpoint anterior.

### Por qué no rompe el envío de respuestas

Se verificó `EnviosFormularioService.enviar()` (usado por mobile en la Etapa 2) antes de hacer el cambio: no depende en ningún punto de `plantilla.subactividad` — solo usa `jornadaId` y `plantillaFormularioId`. La relación a subactividad existía únicamente para *organizar/filtrar* plantillas al administrarlas, nunca fue una validación de negocio en el envío. Cambio seguro.

### Otros consumidores corregidos

- `EnvioProcesamientoService.procesarEnvio()` (Bull, completa automáticamente la jornada): su query de "plantillas activas de las subactividades de la jornada" se adaptó de `where: { subactividad: { id: In(...) } }` a `where: { subactividades: { id: In(...) } }` — misma sintaxis TypeORM, solo cambia singular→plural porque ahora es relación N:N.
- `ReportesService.avanceActividades()`: usaba `countBy({ subactividad: { id } })` y un `innerJoin` crudo sobre la columna `plantilla.subactividad_id` (que ya no existe como columna directa). Se migró a `createQueryBuilder` con `innerJoin('plantilla.subactividades', 'subactividad')` pasando por la tabla intermedia.

### Impacto en frontend

- `PlantillaFormulario.subactividadId: string` → `subactividadIds: string[]`.
- El builder (`editor-plantilla-formulario.tsx`) ya no bloquea el guardado sin proyecto/subactividad seleccionados — la sección "Proyectos asignados (opcional)" muestra checkboxes (chips) agrupados por proyecto, cargando todos los proyectos y sus planes de una vez al montar (en vez del selector encadenado proyecto→subactividad de la versión anterior, porque ahora se permite selección múltiple simultánea entre proyectos distintos).
- El listado (`gestion-formularios.tsx`) muestra una columna "Proyectos asignados" con el conteo de subactividades vinculadas, o "Sin asignar" si el array está vacío.
- "Clonar" dejó de abrir un modal (ya no pide subactividad destino) — es un botón de acción directa que duplica la plantilla sin asignaciones.

### Verificación

- `tsc --noEmit` limpio en ambos proyectos tras el cambio.
- Backend reiniciado con `synchronize: true` (modo dev): TypeORM recreó el esquema sin errores, la tabla `plantilla_formulario_subactividades` se generó correctamente y la columna vieja `subactividad_id` en `plantillas_formulario` desapareció sin conflicto.
- Rutas verificadas en el log de arranque, incluyendo la nueva `PATCH /formularios/plantillas/:id/subactividades`.
- Pendiente de verificación manual en navegador por el usuario (misma limitación de la sesión: sin extensión de Chrome conectada).

### Atajo de asignación desde el listado

El usuario preguntó dónde se hace la asignación de proyectos — la respuesta inicial fue "solo dentro del editor completo de la plantilla" (sección "Proyectos asignados"), lo cual obligaba a abrir todo el builder de campos solo para reasignar. Se agregó un botón **"Asignar"** por fila en `gestion-formularios.tsx` que abre un modal ligero (reutiliza el componente `Modal` de `ui/modal.tsx`) con los mismos chips de proyecto/subactividad, pero sin cargar el editor de campos — llama directamente a `PATCH /formularios/plantillas/:id/subactividades` (`asignarSubactividadesPlantilla` en `lib/api.ts`). Esto deja dos caminos válidos para asignar: desde el listado (rápido, solo asignación) o desde el editor completo (al crear/editar la plantilla).

---

## Etapa 2 (futura — pendiente, no implementada aún)

Objetivo: cerrar el ciclo de vida completo de un formulario dinámico, más allá del diseño de la plantilla.

1. **Asignación de plantillas**: ya existe la relación N:N `PlantillaFormulario ↔ Subactividad` (`PATCH /formularios/plantillas/:id/subactividades`) como mecanismo base. Falta decidir si esto es suficiente para mobile o si hace falta una asignación más granular a usuario/técnico específico (ej. tabla `asignaciones_formulario` con usuario), dado que hoy la asignación es a nivel de subactividad completa, no de usuario individual.
2. **Visualización en mobile**: el motor de captura de `ruralia-mobile` (`src/components/FormularioCaptura.jsx`, `src/lib/formSchema.js`) hoy usa un schema local propio, desconectado del contrato real `PlantillaFormulario`/`CampoFormulario` del backend. Hay que conectar ese componente a `GET /formularios/plantillas/subactividad/:subactividadId` (o al mecanismo de asignación que se defina) para que renderice dinámicamente según `TipoCampo`.
3. **Sincronización de respuestas**: el mobile debe enviar respuestas usando el contrato ya existente `POST /formularios/envios` (`EnviarFormularioDto`), pero hay que resolver la discrepancia de endpoint detectada en sesiones previas de mobile (`POST /registros` vs. el real `POST /sincronizacion/subir` / `POST /formularios/envios`) y la renovación de token Firebase antes de sincronizar envíos acumulados offline (expira en 1h).
4. **Procesamiento de respuestas**: ya existe `EnvioProcesamientoService` (Bull, sesión 05) que completa automáticamente la jornada cuando se cumplen los formularios obligatorios de sus plantillas activas — confirmar que este flujo siga siendo válido una vez se introduzca el mecanismo de asignación de la Etapa 2, o si necesita ajustarse.
5. **Permisos de captura**: definir qué rol(es) pueden enviar respuestas (`POST /formularios/envios`) — hoy el endpoint no tiene `@Roles`, y el flujo esperado es que sea el técnico de campo (rol `TECNICO`) quien complete formularios asignados.

---

## Referencia de sesiones

| Sesión | Documento | Contenido |
|--------|-----------|-----------|
| 05 | [SESION-05-jornadas-formularios.md](./SESION-05-jornadas-formularios.md) | Modelo original de jornadas y formularios |
| 09 | (este documento) | Roles + endpoints faltantes + UI de administración de plantillas (Etapa 1) |
