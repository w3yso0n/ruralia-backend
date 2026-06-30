# Actividades Jira — Ruralia (2 semanas)

Resumen de avances documentados en las sesiones 01–06, dividido en **20 actividades** (5–10 palabras cada una) para carga en Jira.

**Distribución:** 2 personas × 2 semanas × 5 actividades = 20 tareas.

> **Alcance:** trabajo principalmente en **backend** (NestJS, TypeORM, API REST). El frontend (`ruralia-frontend`) quedó en etapa inicial: proyecto Next.js con dependencias base, sin pantallas ni integración de negocio aún.

---

## Persona A

### Semana 1

| # | Actividad |
|---|-----------|
| 1 | Configurar TypeORM PostgreSQL y variables entorno |
| 2 | Crear diez módulos dominio con entidades |
| 3 | Definir enums y relaciones del modelo |
| 4 | Registrar módulos y tablas intermedias ManyToMany |
| 5 | Modelar jornadas formularios dinámicos evidencias e indicadores |

### Semana 2

| # | Actividad |
|---|-----------|
| 11 | Agregar campos idempotencia entidades offline |
| 12 | Implementar endpoint sincronización offline móvil |
| 13 | Crear módulo subida archivos con Multer |
| 14 | Configurar cola Bull Redis con degradación |
| 15 | Implementar throttling global y por usuario |

---

## Persona B

### Semana 1

| # | Actividad |
|---|-----------|
| 6 | Implementar CRUD REST completo proyectos |
| 7 | Diseñar DTOs validación y respuesta proyectos |
| 8 | Asignar territorios personal y permisos coordinador |
| 9 | Configurar ValidationPipe y serialización global |
| 10 | Implementar estadísticas y suspensión de proyectos |

### Semana 2

| # | Actividad |
|---|-----------|
| 16 | Integrar Firebase Admin SDK autenticación |
| 17 | Implementar guards globales y decoradores auth |
| 18 | Crear endpoint obtener usuario autenticado |
| 19 | Desarrollar CRUD jornadas y formularios dinámicos |
| 20 | Crear indicadores reportes JSON y Swagger |

---

## Vista por semana

### Semana 1 — dominio y proyectos (sesiones 01, 03)

| Persona A | Persona B |
|-----------|-----------|
| Configurar TypeORM PostgreSQL y variables entorno | Implementar CRUD REST completo proyectos |
| Crear diez módulos dominio con entidades | Diseñar DTOs validación y respuesta proyectos |
| Definir enums y relaciones del modelo | Asignar territorios personal y permisos coordinador |
| Registrar módulos y tablas intermedias ManyToMany | Configurar ValidationPipe y serialización global |
| Modelar jornadas formularios dinámicos evidencias e indicadores | Implementar estadísticas y suspensión de proyectos |

### Semana 2 — auth, sync y módulos operativos (sesiones 02, 04–06)

| Persona A | Persona B |
|-----------|-----------|
| Agregar campos idempotencia entidades offline | Integrar Firebase Admin SDK autenticación |
| Implementar endpoint sincronización offline móvil | Implementar guards globales y decoradores auth |
| Crear módulo subida archivos con Multer | Crear endpoint obtener usuario autenticado |
| Configurar cola Bull Redis con degradación | Desarrollar CRUD jornadas y formularios dinámicos |
| Implementar throttling global y por usuario | Crear indicadores reportes JSON y Swagger |

---

## Referencia de sesiones

| Sesión | Documento | Contenido |
|--------|-----------|-----------|
| 01 | [SESION-01-estructura-dominio.md](./SESION-01-estructura-dominio.md) | Dominio, entidades, TypeORM |
| 02 | [SESION-02-autenticacion-firebase.md](./SESION-02-autenticacion-firebase.md) | Firebase, guards, decoradores |
| 03 | [SESION-03-crud-proyectos.md](./SESION-03-crud-proyectos.md) | CRUD proyectos, DTOs, permisos |
| 04 | [SESION-04-sincronizacion-offline.md](./SESION-04-sincronizacion-offline.md) | Sync offline, archivos, Bull |
| 05 | [SESION-05-jornadas-formularios.md](./SESION-05-jornadas-formularios.md) | Jornadas y formularios |
| 06 | [SESION-06-indicadores-reportes-swagger.md](./SESION-06-indicadores-reportes-swagger.md) | Indicadores, reportes JSON, Swagger |
