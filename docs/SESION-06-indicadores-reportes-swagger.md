# Ruralia Backend — Documentación de sesión 06

> **Fecha:** 25 de junio de 2026  
> **Sesión:** Indicadores, reportes, Swagger y healthcheck

---

## Dependencias instaladas

```bash
pnpm add @nestjs/swagger swagger-ui-express fast-csv @nestjs/terminus
```

---

## IndicadoresModule

### IndicadoresService

| Método | Descripción |
|--------|-------------|
| `crear` | Crea indicador y lo asocia a proyectos |
| `listar` / `obtenerUno` | Consultas estándar |
| `registrarValor` | Crea `RegistroIndicador`; valida jornada ∈ proyecto del indicador |
| `obtenerAvance` | Por proyecto: meta, actual, %, tendencia (últimos 5) |
| `obtenerLineaTiempo` | Serie temporal con rango de fechas |

**Valor actual:** suma si `CUANTITATIVO`, último valor si `CUALITATIVO`.

### Rutas

| Método | Ruta |
|--------|------|
| POST | `/indicadores` |
| GET | `/indicadores` |
| GET | `/indicadores/proyecto/:proyectoId/avance` |
| GET | `/indicadores/:id` |
| GET | `/indicadores/:id/linea-tiempo` |
| POST | `/indicadores/:id/registros` |

---

## ReportesModule (solo lectura)

`@Roles(ADMINISTRADOR, COORDINADOR)` en todo el controller.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/reportes/proyecto/:id/resumen` | Datos generales y conteos |
| GET | `/reportes/proyecto/:id/beneficiarios` | Beneficiarios con métricas |
| GET | `/reportes/proyecto/:id/avance-actividades` | Planificado vs ejecutado |
| GET | `/reportes/proyecto/:id/mapa-calor` | Por vereda con centroide GPS |

**Formato:** `?formato=json` (default) o `?formato=csv` (stream con `fast-csv`).

---

## Swagger / OpenAPI

- **Título:** Rural-IA API v1.0
- **Auth:** Bearer JWT (Firebase)
- **UI:** `/api/documentacion`
- **JSON:** `/api/documentacion-json`

Todos los controllers y DTOs decorados con `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiProperty` (descripciones en español).

---

## Healthcheck

```
GET /salud  (@Publica)
```

Verifica:
- `base_datos` — TypeORM ping
- `redis` — conexión Redis (`conectado: true/false`, no falla si está en modo degradado)

---

## Historial de sesiones

| Sesión | Contenido |
|--------|-----------|
| 01–05 | Dominio, auth, proyectos, sync, jornadas/formularios |
| 06 | Indicadores, reportes, Swagger, salud |

Ver también: **[PENDIENTES-Y-DESPLIEGUE.md](./PENDIENTES-Y-DESPLIEGUE.md)** — formularios del cliente, Redis en VPS, Cloudflare, Coolify (back + front).
