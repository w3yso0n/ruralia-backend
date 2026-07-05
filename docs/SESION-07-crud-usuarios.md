# Ruralia Backend — Documentación de sesión 07

> **Fecha:** 4 de julio de 2026  
> **Sesión:** CRUD de usuarios (Firebase + PostgreSQL)

---

## Resumen

Se implementó la API de gestión de usuarios para el panel web. Los usuarios se crean en **Firebase Auth** y en **PostgreSQL** con roles asignables. Solo accesible por rol `ADMINISTRADOR`.

---

## Firebase Admin ampliado

`FirebaseAdminService` (`src/autenticacion/firebase-admin.service.ts`):

| Método | Descripción |
|--------|-------------|
| `crearUsuario` | `createUser` con email, password, displayName |
| `actualizarUsuario` | email, password, displayName, disabled |
| `eliminarUsuario` | `deleteUser` (rollback al crear si falla BD) |

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/usuarios/roles` | Lista roles del sistema |
| GET | `/usuarios` | Listar con filtros (`busqueda`, `estaActivo`, paginación) |
| GET | `/usuarios/:id` | Detalle con roles |
| POST | `/usuarios` | Crear usuario Firebase + BD |
| PATCH | `/usuarios/:id` | Actualizar datos, roles, estado |
| DELETE | `/usuarios/:id` | Desactivar (`estaActivo=false`, Firebase disabled) |

Todos requieren `@Roles(ADMINISTRADOR)`.

---

## DTOs

### CrearUsuarioDto
- `correo`, `contrasena` (min 6), `nombreCompleto`, `roles[]`, `urlFoto?`

### ActualizarUsuarioDto
- Todos opcionales: `correo`, `contrasena`, `nombreCompleto`, `urlFoto`, `estaActivo`, `roles[]`

### FiltrosUsuarioDto
- `busqueda?`, `estaActivo?`, `pagina?`, `limite?`

---

## Reglas de negocio

- No se puede desactivar ni eliminar la propia cuenta
- Correo único en BD
- Al crear: si falla PostgreSQL, se revierte el usuario en Firebase
- `DELETE` es soft delete (no borra registro ni cuenta Firebase, solo deshabilita)
- Roles base se crean automáticamente si no existen (`ADMINISTRADOR`, `COORDINADOR`, `TECNICO`, `VISUALIZADOR`)

---

## Conexión con frontend

Consumido desde `ruralia-frontend` sesión 03. Ver [`ruralia-frontend/docs/SESION-03-sidebar-usuarios-proyectos.md`](../../ruralia-frontend/docs/SESION-03-sidebar-usuarios-proyectos.md).

---

## Historial de sesiones

| Sesión | Contenido |
|--------|-----------|
| 01–06 | Dominio, auth, proyectos, sync, jornadas, indicadores |
| 07 | CRUD usuarios + Firebase Admin extendido |
