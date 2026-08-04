# RF-18 / RF-19 — Avance Semana 6

Funcionalidad de producción: trazabilidad (RF-18) y flujo de aprobación/rechazo (RF-19), integrados en backend, panel web y móvil.

## Seed de plataforma (datos reales de prueba)

```bash
# 1) Backend al menos una vez (schema + roles)
# 2) Territorios (si aún no hay veredas)
pnpm run seed:territorios

# 3) Dataset completo
pnpm run seed:plataforma
```

Crea: admin, supervisor, técnico (login Firebase si `.env` tiene credenciales), beneficiario, proyecto activo, plan completo (actividad→sub→proceso→meta), plantillas, 2 jornadas (completada en revisión + futura borrador), documento versionado, rechazo resuelto, audit_logs y cronología.

Credenciales por defecto (si Firebase OK):

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Admin | `admin.seed@ruralia.local` | `RuraliaSeed2026!` |
| Supervisor | `supervisor.seed@ruralia.local` | `RuraliaSeed2026!` |
| Técnico | `campo.seed@ruralia.local` | `RuraliaSeed2026!` |

Luego abre `/revision` con el supervisor.

## Qué quedó implementado

| Capacidad | Dónde |
|-----------|--------|
| Estados funcionales | `jornadas`, `evidencias`, `documents` |
| Bitácora append-only | `audit_logs`, `GET /auditoria` |
| Documentos versionados | `documents` + `document_versions` |
| Aprobar / rechazar | `POST /aprobaciones/*` |
| Bandejas + contadores | UI `/revision` |
| Seguimiento enriquecido | eventos de revisión |
| Mobile | badges + enviar/reenviar |

## Flujo rápido

1. Supervisor → `/revision` → «Visita predio María Pérez» en `EN_REVISION`.
2. Aprobar o rechazar con categoría + corrección.
3. Técnico → jornada futura en borrador / correcciones.
4. `/seguimiento` muestra el historial sembrado.
