# Ruralia — Pendientes, requisitos del cliente e infraestructura

> Documento vivo con lo que **falta por hacer** y **qué necesitamos que el cliente nos aclare o nos entregue**.  
> Complementa las sesiones técnicas (`SESION-01` … `SESION-06`).

---

## Estado actual del backend

| Componente | Estado |
|------------|--------|
| API NestJS + PostgreSQL | Implementado |
| Autenticación Firebase | Implementado |
| Dominio (10 módulos, entidades, relaciones) | Implementado |
| CRUD proyectos | Implementado |
| Jornadas + formularios (operativo) | Implementado |
| Indicadores + reportes (lectura) | Implementado |
| Sync offline + archivos | Implementado (colas opcionales) |
| Swagger `/api/documentacion` | Implementado |
| Healthcheck `/salud` | Implementado |
| **CRUD beneficiarios, asociaciones, territorios, actividades** | Solo entidades — **sin API aún** |
| **Seeds / carga inicial de datos** | Pendiente |
| **Redis en servidor** | Pendiente |
| **Despliegue en VPS (Coolify)** | Pendiente |
| **Cloudflare** | Pendiente |
| **Formularios y reglas reales del cliente** | Pendiente |
| **App móvil / frontend** | Fuera de este repo |

---

## 1. Lo que necesitamos del cliente (preguntas y documentos)

Revisión cruzada de todo lo construido (sesiones 01–06). Todo lo que **asumimos** o **no está definido** y debe confirmarse antes de cerrar producción.

---

### A. Visión general y alcance

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| A1 | ¿Cuál es el **objetivo principal** del sistema en los próximos 6–12 meses? (seguimiento de proyectos, reportes a donantes, control de técnicos en campo, etc.) | Priorizar desarrollo del front y módulos sin API |
| A2 | ¿Quiénes son los **usuarios finales** y cuántos aprox.? (admins, coordinadores, técnicos, visualizadores, beneficiarios) | Dimensionar VPS, Firebase y permisos |
| A3 | ¿Habrá **app móvil**, **web**, o ambas? ¿Offline obligatorio en campo? | Ya hay sync offline; confirmar alcance real |
| A4 | ¿Existe **manual de operación**, organigrama o descripción de procesos actual (aunque sea en Word/PDF)? | Alinear flujos con la operación real |
| A5 | ¿Hay **reportes obligatorios** para entidades externas (ministerios, ONG donantes, gobierno)? Ejemplos en Excel/PDF | Validar módulo `reportes` e indicadores |
| A6 | ¿Nombre oficial del producto: **Rural-IA**, **Ruralia** u otro? Logo y colores | Front, Swagger, dominios |

---

### B. Usuarios, roles y Firebase (Sesión 02)

El sistema usa **Firebase Auth** + roles en BD: `ADMINISTRADOR`, `COORDINADOR`, `TECNICO`, `VISUALIZADOR`.

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| B1 | Acceso al **proyecto Firebase** (o que nos creen cuenta de servicio y nos inviten) | Ya configurado en backend; falta proyecto real del cliente |
| B2 | ¿Métodos de login? (correo/contraseña, Google, teléfono, Microsoft) | Configurar Firebase Authentication |
| B3 | Usuario nuevo entra con rol **VISUALIZADOR** por defecto. ¿Quién y cómo **asigna roles**? (panel admin, solicitud por correo, lista fija) | Hoy no hay endpoint para cambiar roles |
| B4 | ¿Un usuario puede tener **varios roles** a la vez? (ej. COORDINADOR + TECNICO) | La BD es ManyToMany; confirmar regla de negocio |
| B5 | Lista inicial de **usuarios** (nombre, correo, rol sugerido) para carga en producción | Evitar que todos queden como VISUALIZADOR |
| B6 | ¿Los técnicos son **empleados internos** o contratistas externos? | Afecta onboarding y permisos |
| B7 | Dominios autorizados en Firebase (`app.*`, `localhost` para dev) | Despliegue + Cloudflare |

---

### C. Territorios (Sesión 01 — sin API ni datos)

Jerarquía en sistema: `Departamento → Municipio → Corregimiento → Vereda`.

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| C1 | ¿En qué **departamentos/municipios** operan? ¿Solo algunos o todo el país? | Cargar territorios (seed o importación) |
| C2 | ¿Usan siempre la jerarquía **corregimiento → vereda** o en ciertas zonas solo municipio → vereda? | Algunos departamentos no usan corregimiento igual |
| C3 | ¿Tienen archivo **oficial de códigos** (DANE/DIVIPOLA) o lista propia en Excel? | Campos `codigo` en cada nivel |
| C4 | ¿Las **veredas** del proyecto coinciden con división política o usan nombres operativos propios? | Validar unicidad de `codigo` |
| C5 | ¿Quién **mantiene** el catálogo territorial (solo admin o coordinadores también)? | Definir permisos del CRUD futuro |

**Documento a pedir:** Excel/CSV con columnas sugeridas:

```text
departamento_codigo | departamento_nombre | municipio_codigo | municipio_nombre |
corregimiento_codigo | corregimiento_nombre | vereda_codigo | vereda_nombre
```

---

### D. Proyectos, actividades y equipos (Sesión 03)

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| D1 | ¿Los tipos de proyecto (`AGRICOLA`, `AMBIENTAL`, `TURISMO`, `OTRO`) son suficientes? ¿Faltan otros? | Enum `TipoProyecto` |
| D2 | ¿Flujo de estados? (`BORRADOR` → `ACTIVO` → `COMPLETADO` / `SUSPENDIDO`). ¿Quién activa un proyecto? | Hoy solo coordinador/admin crean; no hay “publicar” explícito |
| D3 | ¿Puede haber **dos proyectos con el mismo nombre** si el tipo es distinto? (así está hoy) | Restricción única `nombre + tipo` |
| D4 | ¿Cómo se definen **actividades y subactividades** por proyecto? ¿Catálogo estándar por tipo o libre cada vez? | Relación Proyecto → Actividad → Subactividad |
| D5 | Ejemplo de **1 proyecto real** con su árbol: actividades, subactividades, fechas, personal | Poblar datos piloto y probar reportes |
| D6 | ¿Un técnico puede estar en **varios proyectos** a la vez? | Relación `proyecto_personal` |
| D7 | ¿Las **veredas asignadas** al proyecto limitan dónde se pueden crear jornadas? (hoy no se valida en backend) | Regla de negocio pendiente |
| D8 | ¿Qué significa **suspender** un proyecto? ¿Se pueden ver datos históricos? ¿Bloquea nuevas jornadas? | DELETE actual = SUSPENDIDO |

---

### E. Beneficiarios y asociaciones (Sesión 01 — entidades sin API)

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| E1 | ¿Cómo se **registran hoy** los beneficiarios? (Excel, formulario papel, otro sistema) | Diseñar CRUD o importación masiva |
| E2 | ¿Un beneficiario puede estar en **varios proyectos**? (así está el modelo N:N) | Confirmar |
| E3 | ¿El beneficiario pertenece a **una vereda fija** o puede cambiar? | Campo `vereda_id` obligatorio |
| E4 | ¿Qué campos son **obligatorios** en la práctica? (documento único ya está en BD) | Validaciones del CRUD futuro |
| E5 | ¿Qué es una **asociación** en su contexto? (junta de acción comunal, cooperativa, etc.) | Validar campos: NIT, representante |
| E6 | ¿Asociación vinculada a **un proyecto** o varios? ¿Siempre a una vereda? | Relaciones actuales |
| E7 | **Documento a pedir:** plantilla Excel de beneficiarios y otra de asociaciones (con columnas que usan hoy) | Importación inicial |
| E8 | ¿Hay **consentimiento / tratamiento de datos personales** (Habeas Data Colombia) para almacenar documentos y fotos? | Evidencias y reportes |

---

### F. Jornadas de campo (Sesión 05)

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| F1 | ¿Quién **crea** la jornada? (coordinador en oficina, técnico en campo, ambos) | Permisos ya abiertos a autenticados |
| F2 | Flujo de estados: `PLANIFICADA → EN_PROGRESO → COMPLETADA`. ¿Se usa **CANCELADA**? ¿Quién y cuándo? | Enum existe; `cambiarEstado` no incluye cancelar |
| F3 | ¿La jornada **siempre** lleva subactividad o a veces solo actividad? | Campo nullable en BD |
| F4 | ¿Los **beneficiarios** de la jornada son los atendidos ese día o todos del proyecto? | ManyToMany `jornada_beneficiarios` |
| F5 | ¿El **equipo** de la jornada es siempre el técnico responsable + ayudantes? ¿Lista fija por proyecto? | `jornada_equipo` |
| F6 | ¿Confirmar regla automática: jornada pasa a **COMPLETADA** cuando todos los formularios obligatorios de la subactividad están llenos? | `ProcesadorEnvios` |
| F7 | ¿Se requiere **GPS obligatorio** al abrir/cerrar jornada? | Campos latitud/longitud en jornada |
| F8 | Ejemplo de **cronograma semanal** real (qué jornadas planean por vereda/actividad) | Prueba de listados y reportes |

---

### G. Formularios dinámicos (Sesiones 01 y 05)

Esta es la parte más crítica para el cliente. Sin sus formularios reales, las plantillas serán genéricas.

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| G1 | Por cada **subactividad**, adjuntar formulario actual (papel, Excel, foto, PDF) | Crear `PlantillaFormulario` + `CampoFormulario` |
| G2 | Por cada campo: etiqueta, tipo, obligatorio, opciones, orden | Ver plantilla abajo |
| G3 | **Reglas condicionales** (“si responde No, ocultar firma”) — ¿las necesitan en v1? | Campo `reglasValidacion` (JSON) |
| G4 | ¿Una subactividad puede tener **varias plantillas** activas o solo una? | Modelo actual: varias por subactividad |
| G5 | Si **cambian** un formulario publicado, ¿qué pasa con envíos ya guardados? ¿Nueva versión? | Campo `version` en plantilla |
| G6 | ¿Quién **crea y publica** plantillas? (solo admin o también coordinador) | Permisos no definidos en controller |
| G7 | ¿Formulario **por jornada** o **por beneficiario** dentro de la jornada? | Afecta app móvil y modelo de envíos |
| G8 | Tipos de campo: ¿necesitan algo que no esté en la lista? (`TEXTO`, `NUMERO`, `FECHA`, `SI_NO`, `SELECCION_*`, `GPS`, `FOTO`, `FIRMA`, `ARCHIVO`) | Enum `TipoCampo` |

#### Plantilla para enviar al cliente (formularios)

```text
Proyecto: ___________________
Actividad: ___________________
Subactividad: ___________________

Campos del formulario:
| # | Pregunta / campo | Tipo (texto/número/fecha/sí-no/lista/foto/firma/GPS) | Obligatorio | Opciones / notas |
|---|------------------|--------------------------------------------------------|-------------|------------------|
| 1 |                  |                                                        | Sí / No     |                  |

Reglas especiales (ej. "si campo 3 = No, no pedir firma"): ___________________
Quién llena el formulario: técnico / beneficiario / ambos
Frecuencia: una vez por jornada / por cada beneficiario / otra: ___________________

Adjuntar: foto o PDF del formulario actual.
```

---

### H. Evidencias, archivos y modo offline (Sesión 04)

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| H1 | ¿Qué tipos de evidencia usan en campo? (foto, video, PDF, firma) — ¿coincide con `FOTO`, `VIDEO`, `DOCUMENTO`, `FIRMA`? | Enum `TipoEvidencia` |
| H2 | ¿Límite de **50 MB por archivo** es aceptable? ¿Videos más largos? | `TAMANO_MAXIMO_ARCHIVO` |
| H3 | ¿Cuánto tiempo puede un técnico trabajar **sin internet** antes de sincronizar? (días, semanas) | Diseño de cola y almacenamiento local en app |
| H4 | Si el mismo registro se edita en **dos dispositivos** offline, ¿cuál prevalece? | Hoy solo idempotencia por `dispositivoId + idLocal` |
| H5 | ¿Los archivos deben quedarse en la **VPS** o migrar a nube (S3, Cloudflare R2)? | Arquitectura futura |
| H6 | ¿Necesitan **descargar** evidencias masivamente para auditorías? | No hay endpoint de export ZIP aún |
| H7 | ¿Las fotos deben llevar **marca de agua** con fecha/GPS/usuario? | Procesamiento de imágenes |

---

### I. Indicadores y reportes (Sesión 06)

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| I1 | Lista de **indicadores** que reportan a donantes o dirección (nombre, unidad, meta, frecuencia) | Poblar `Indicador` |
| I2 | ¿Indicador **cuantitativo** = suma de registros y **cualitativo** = último valor? ¿Es correcto? | Lógica en `obtenerAvance` |
| I3 | ¿Metas son por **proyecto completo** o por vereda / periodo? | Campo `valorMeta` |
| I4 | ¿Quién **registra** valores de indicadores? (técnico en jornada, coordinador en oficina) | `RegistroIndicador` |
| I5 | ¿Los **reportes** actuales (resumen, beneficiarios, avance actividades, mapa calor) cubren lo que necesitan? ¿Faltan columnas? | Ajustar `ReportesService` |
| I6 | ¿Necesitan exportar reportes en **formato específico** para un donante? (plantilla Excel fija) | Hoy: JSON o CSV genérico |
| I7 | **Mapa de calor:** ¿tienen coordenadas o polígonos de veredas, o basta el promedio GPS de jornadas? | Hoy: centroide de jornadas |
| I8 | ¿Quién puede ver reportes además de ADMIN y COORDINADOR? (¿VISUALIZADOR solo lectura?) | Permisos actuales |

---

### J. Infraestructura, dominios y despliegue

| # | Pregunta / documento | Por qué lo necesitamos |
|---|----------------------|------------------------|
| J1 | ¿Dominio(s) definitivos? (`app.tudominio.com`, `api.tudominio.com`) | Cloudflare + Coolify + Firebase |
| J2 | ¿Quién administra la **VPS** y **Coolify**? ¿Nos dan acceso? | Despliegue |
| J3 | ¿Ya tienen cuenta **Cloudflare**? | DNS y SSL |
| J4 | Repositorio y stack del **frontend** (React, Next, Vue, Flutter, etc.) | Coolify + variables de entorno |
| J5 | ¿Política de **backups** (BD + carpeta `/subidas`)? ¿Frecuencia? | Operación producción |
| J6 | ¿Correo transaccional necesario? (invitaciones, alertas) | No implementado |
| J7 | ¿Solo **español** en la interfaz? | i18n |

---

### Checklist — documentos a solicitar al cliente

Marcar cuando se reciba:

- [ ] **A4** — Manual o descripción de procesos operativos  
- [ ] **B5** — Lista de usuarios iniciales (correo, nombre, rol)  
- [ ] **B1** — Acceso proyecto Firebase o credenciales de servicio  
- [ ] **C3** — Archivo territorial (DIVIPOLA o lista propia)  
- [ ] **D5** — Ejemplo de proyecto real con actividades/subactividades  
- [ ] **E7** — Plantillas Excel beneficiarios y asociaciones  
- [ ] **G1–G2** — Formularios por subactividad (plantilla de sección G)  
- [ ] **I1** — Lista de indicadores con metas  
- [ ] **I5** — Ejemplos de reportes que entregan hoy a donantes  
- [ ] **A5** — Reportes obligatorios externos (PDF/Excel de referencia)  
- [ ] **J1** — Dominios definitivos  
- [ ] **E8** — Política de privacidad / autorización tratamiento de datos  

---

### Dudas técnicas abiertas (para decidir con el cliente)

Estas decisiones **ya están codificadas de cierta forma** pero conviene validarlas en reunión:

| Tema | Supuesto actual | Pregunta al cliente |
|------|-----------------|-------------------|
| Rol por defecto | VISUALIZADOR al primer login | ¿Correcto? |
| Cierre de jornada | Automático al completar todos los formularios obligatorios | ¿Quieren aprobación manual del coordinador? |
| Proyecto para jornada | Debe estar `ACTIVO` | ¿BORRADOR permite pruebas piloto? |
| Coordinador en proyecto | Solo gestiona si está en `personal` | ¿O cualquier coordinador de la org? |
| Suspender proyecto | No borra datos | ¿Bloquea nuevas jornadas? (no implementado) |
| Sincronización offline | Idempotente por dispositivo | ¿Conflictos entre dispositivos? |
| Almacenamiento archivos | Disco local VPS `/subidas` | ¿Suficiente a largo plazo? |
| Indicadores cualitativos | Último valor registrado | ¿Otra lógica? |

---

## 2. Montar Redis en la VPS

Redis es **necesario en producción** para:

- Cola `cola-evidencias` (procesar fotos/documentos en background)
- Cola `cola-envios` (post-proceso de formularios y cierre automático de jornadas)

Sin Redis, el backend **arranca igual** (modo degradado, procesamiento síncrono), pero bajo carga o con archivos grandes la API puede volverse lenta.

### Variables en `.env` (producción)

```env
REDIS_HOST=localhost          # o nombre del servicio en Docker/Coolify
REDIS_PORT=6379
```

### Opción A — Contenedor Docker en la VPS

```bash
docker run -d \
  --name ruralia-redis \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  redis:7-alpine
```

Recomendación: exponer Redis solo en `127.0.0.1` (no público en internet). El backend en la misma VPS se conecta por `localhost`.

### Opción B — Servicio Redis en Coolify

1. En Coolify → **New Resource** → **Database** → **Redis**.
2. Anotar host interno (nombre del servicio en la red de Coolify).
3. En el servicio del backend, variables:
   - `REDIS_HOST=<nombre-servicio-redis>`
   - `REDIS_PORT=6379`

### Verificación

```bash
curl http://localhost:3000/salud
```

Respuesta esperada (fragmento):

```json
{
  "status": "ok",
  "info": {
    "base_datos": { "status": "up" },
    "redis": { "status": "up", "conectado": true }
  }
}
```

Al arrancar con Redis disponible, el log debe mostrar:

```text
[ColaModule] Redis conectado. Colas Bull habilitadas.
```

---

## 3. Configurar Cloudflare

Cloudflare va delante de la VPS: DNS, HTTPS, protección básica y (opcional) CDN para assets estáticos del front.

### Checklist Cloudflare

| Paso | Acción |
|------|--------|
| 1 | Dominio añadido a Cloudflare (nameservers del registrador apuntando a Cloudflare) |
| 2 | Registro **A** o **CNAME** `api.tudominio.com` → IP de la VPS (o túnel Coolify) — **Proxied** (nube naranja) |
| 3 | Registro **A** o **CNAME** `app.tudominio.com` (frontend) → misma VPS o hosting del front — **Proxied** |
| 4 | **SSL/TLS** → modo **Full (strict)** si el origen tiene certificado válido (Coolify/Let's Encrypt) |
| 5 | **Always Use HTTPS** activado |
| 6 | (Opcional) **WAF** / reglas de rate limit para `/api/*` como capa extra al throttling de Nest |
| 7 | (Opcional) **Caching** desactivado o bypass para `api.tudominio.com` (API no debe cachearse) |

### Cabeceras y Firebase

- La app móvil/web usará `https://api.tudominio.com`.
- En Firebase Console → Authentication → dominios autorizados: añadir `app.tudominio.com` y el dominio de preview si aplica.
- CORS en el backend: permitir origen del front (`https://app.tudominio.com`).

### Túnel Cloudflare (alternativa a IP pública)

Si no quieres abrir puertos 80/443 en la VPS:

- Instalar **cloudflared** y crear un túnel hacia los servicios internos de Coolify.
- Documentación: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)

---

## 4. Montar backend y frontend en Coolify (VPS)

[Coolify](https://coolify.io/) gestiona despliegues Docker en la VPS con SSL, variables de entorno y redes internas (ideal para PostgreSQL + Redis + API + front).

### Arquitectura objetivo en la VPS

```mermaid
flowchart TB
    subgraph Internet
        CF[Cloudflare]
    end
    subgraph VPS
        subgraph Coolify
            FE[Frontend - app.tudominio.com]
            BE[Backend NestJS - api.tudominio.com]
            PG[(PostgreSQL)]
            RD[(Redis)]
        end
    end
    CF --> FE
    CF --> BE
    BE --> PG
    BE --> RD
    BE --> Vol[Volúmen: /subidas]
```

### Backend (este repositorio `ruralia-backend`)

1. **Nuevo proyecto** en Coolify → conectar repositorio Git.
2. **Build pack**: Dockerfile o Nixpacks (Node 20+).
3. **Comando de arranque**: `pnpm run start:prod` (tras `pnpm build`).
4. **Puerto interno**: `3000` (o `PORT` del `.env`).
5. **Dominio**: `api.tudominio.com` + Let's Encrypt vía Coolify.
6. **Variables de entorno** (mínimas):

```env
NODE_ENV=production
PORT=3000

DB_HOST=<servicio-postgres-coolify>
DB_PORT=5432
DB_USERNAME=...
DB_PASSWORD=...
DB_DATABASE=ruralia

REDIS_HOST=<servicio-redis-coolify>
REDIS_PORT=6379

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

RUTA_SUBIDAS=/app/subidas
TAMANO_MAXIMO_ARCHIVO=52428800
```

7. **Volumen persistente**: montar `/app/subidas` para evidencias y archivos subidos.
8. **PostgreSQL**: crear como servicio en Coolify en la misma red; no usar `synchronize: true` en producción a largo plazo — planificar migraciones TypeORM cuando el esquema se estabilice.

### Frontend (repositorio aparte)

1. Nuevo servicio en Coolify apuntando al repo del front (React/Next/Vue, etc.).
2. **Variables de build** típicas:
   - `VITE_API_URL=https://api.tudominio.com` (o equivalente según stack)
   - Config Firebase del cliente (apiKey, authDomain, etc.)
3. **Dominio**: `app.tudominio.com`.
4. Build estático o SSR según el framework; Coolify puede servir con Nginx o el runtime de Node si es Next.

### Orden recomendado de despliegue

1. PostgreSQL en Coolify  
2. Redis en Coolify  
3. Backend → verificar `/salud` y `/api/documentacion`  
4. Frontend → login Firebase contra API  
5. Cloudflare apuntando a ambos dominios  
6. Prueba end-to-end: login → crear proyecto → jornada → envío formulario → subida evidencia  

---

## 5. Otros pendientes técnicos (resumen)

| Ítem | Prioridad | Notas |
|------|-----------|--------|
| Respuestas del cliente (sección 1) | **Alta** | Bloquea datos reales y reglas de negocio |
| CRUD beneficiarios / asociaciones / territorios | Alta | Entidades sin API |
| Gestión de roles de usuario (admin) | Alta | Tras definir con cliente (B3) |
| Formularios del cliente | Alta | Sección G |
| Redis en VPS | Alta | Colas Bull en producción |
| Coolify back + front | Alta | Sección 4 |
| Cloudflare | Alta | DNS + SSL |
| Seeds (roles, territorios) | Media | Tras recibir archivos del cliente |
| Desactivar `synchronize: true` | Media | Cuando el esquema esté estable |
| CORS explícito en `main.ts` | Media | Al tener URL del front |
| Validar jornada dentro de veredas del proyecto | Media | Dudas técnicas abiertas |
| Backups PostgreSQL + volumen `/subidas` | Alta | Política en Coolify o cron |
| Export masivo evidencias / reportes donante | Baja–Media | Según I5–I6 |
| Monitoreo / logs | Baja | Coolify logs, opcional Sentry |

---

## 6. Historial de documentación

| Documento | Contenido |
|-----------|-----------|
| [SESION-01](./SESION-01-estructura-dominio.md) | Dominio y entidades |
| [SESION-02](./SESION-02-autenticacion-firebase.md) | Firebase Auth |
| [SESION-03](./SESION-03-crud-proyectos.md) | CRUD proyectos |
| [SESION-04](./SESION-04-sincronizacion-offline.md) | Sync offline + archivos |
| [SESION-05](./SESION-05-jornadas-formularios.md) | Jornadas y formularios |
| [SESION-06](./SESION-06-indicadores-reportes-swagger.md) | Indicadores, reportes, Swagger |
| **PENDIENTES-Y-DESPLIEGUE** (este doc) | Preguntas al cliente, Redis, Cloudflare, Coolify |

---

## 7. Seguimiento con el cliente (reunión sugerida)

Agenda mínima para una sesión de 60–90 min:

1. **Visión y usuarios** (sección A + B) — 15 min  
2. **Territorios y datos maestros** (C + E7) — 15 min  
3. **Flujo de campo: jornada → formulario → evidencia** (F + G) — 25 min  
4. **Indicadores y reportes a donantes** (I) — 15 min  
5. **Infraestructura y dominios** (J + secciones 2–4) — 10 min  

Entregables que pedir al cerrar la reunión:

- [ ] Formularios piloto (al menos 2 subactividades)  
- [ ] Excel territorios + beneficiarios  
- [ ] Lista usuarios y roles  
- [ ] Acceso Firebase  
- [ ] Dominios y contacto técnico VPS/Coolify  
