# Ruralia Backend — SESION 08: Plan de trabajo y administración de proyectos

> **Fecha:** 5 de julio de 2026  
> **Alcance:** Jornadas N:N, CRUD plan, vínculos con `es_principal`, filtros enriquecidos

---

## Resumen

Implementación del dominio de administración de proyectos acordado en el plan full-stack:

1. **A.0** — Tabla `jornada_actividades` (Escenario B N:N)
2. **A.1** — CRUD actividades/subactividades + completar/reabrir + `/plan` y `/progreso`
3. **A.2 / B** — `es_principal` en vínculos, CRUD beneficiarios/asociaciones, filtros listado, cancelar jornada, veredas

---

## A.0 — Jornadas N:N

### Entidad `JornadaActividad`

Tabla `jornada_actividades`: `jornada_id`, `actividad_id`, `subactividad_id?`, `estado_ejecucion`, `nota`, `orden`.

### Cambios

- `Jornada`: eliminados FK directos; relación `OneToMany` → `jornadaActividades`
- `CrearJornadaDto.actividades[]` en lugar de `actividadId` único
- Sync offline: `JornadaOfflineDto.actividades[]`
- Reportes: join vía `jornada_actividades`
- `DELETE /jornadas/:id` → cancelar jornada

---

## A.1 — Plan y completado

### Campos en `Actividad` / `Subactividad`

- `estadoAvance`: `PENDIENTE | COMPLETADA`
- `notaCompletado`, `completadaEn`, `completadaPor`

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/proyectos/:id/plan` | Árbol con progreso por nodo |
| GET | `/proyectos/:id/progreso` | % agregado del plan |
| POST | `/proyectos/:id/actividades` | Crear actividad |
| PATCH | `/actividades/:id/completar` | Marcar hoja completada |
| PATCH | `/actividades/:id/reabrir` | Reabrir |
| POST | `/actividades/:id/subactividades` | Crear subactividad |
| PATCH | `/subactividades/:id/completar` | Marcar subactividad |
| PATCH | `/subactividades/:id/reabrir` | Reabrir |

**Regla:** no se puede completar una actividad que tiene subactividades activas.

---

## A.2 / B — Vínculos y filtros

### `es_principal`

Entidades explícitas:
- `ProyectoBeneficiario` (`proyecto_beneficiarios`)
- `ProyectoAsociacion` (`proyecto_asociaciones`)

Constraint de negocio: máximo un principal por proyecto al asignar.

### Nuevos módulos

- `BeneficiariosController` — CRUD `/beneficiarios`
- `AsociacionesController` — CRUD `/asociaciones`
- `TerritoriosController` — `GET /territorios/veredas`

### Asignación a proyecto

- `POST /proyectos/:id/beneficiarios` — body `{ beneficiarios: [{ beneficiarioId, esPrincipal? }] }`
- `POST /proyectos/:id/asociaciones` — body `{ asociaciones: [{ asociacionId, esPrincipal? }] }`

### Filtros `GET /proyectos`

`personalId`, `asociacionId`, `veredaId`, `orden` (`nombre_asc|desc`, `creado_asc|desc`).

Respuesta enriquecida: `progresoPorcentaje`, `beneficiarioPrincipal`, `asociacionPrincipal`, `personal`.

---

## Progreso agregado

- Subactividad: `COMPLETADA` = 100%, `PENDIENTE` = 0%
- Actividad con subactividades: promedio de subactividades activas
- Actividad hoja: su propio `estadoAvance`
- Proyecto: promedio de actividades activas

---

## Módulos tocados

`actividades/`, `jornadas/`, `proyectos/`, `beneficiarios/`, `asociaciones/`, `territorios/`, `sincronizacion/`, `reportes/`, `formularios/envio-procesamiento.service.ts`
