# Ruralia Backend — Documentación de sesión 01

> **Fecha:** 25 de junio de 2026  
> **Sesión:** Estructura base de dominio (módulos, entidades, enums y relaciones)  
> **Gestor de paquetes:** pnpm

Este documento registra todo lo construido en esta ejecución para que cualquier persona pueda entender qué existe, cómo se conecta y cómo levantar el proyecto.

---

## Resumen de la sesión

Se partió de un proyecto **NestJS recién instalado** sin módulos de dominio. En esta sesión se:

1. Instalaron dependencias con **pnpm**
2. Configuró **TypeORM + PostgreSQL** en `AppModule` con `synchronize: true`
3. Se crearon **10 módulos de dominio** con **22 entidades** y **11 enums**
4. Se verificó la compilación con `pnpm run build` (exitosa)

**No se creó:** migraciones, seeds, controladores, servicios ni lógica de negocio.

---

## Dependencias instaladas (pnpm)

```bash
pnpm add @nestjs/typeorm typeorm pg @nestjs/config
```

| Paquete | Uso |
|---------|-----|
| `@nestjs/typeorm` | Integración NestJS ↔ TypeORM |
| `typeorm` | ORM y mapeo de entidades |
| `pg` | Driver PostgreSQL |
| `@nestjs/config` | Variables de entorno (`DB_HOST`, etc.) |

---

## Configuración de base de datos

Archivo: `src/app.module.ts`

```ts
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ruralia',
  autoLoadEntities: true,
  synchronize: true,
});
```

Variables de entorno de referencia: `.env.example`

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=ruralia
PORT=3000
```

Al iniciar el backend con PostgreSQL disponible, TypeORM crea/actualiza las tablas automáticamente.

### Cómo levantar

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Asegurar que PostgreSQL esté corriendo y la BD exista

# 3. Iniciar en desarrollo
pnpm run start:dev
```

---

## Convenciones aplicadas

| Convención | Detalle |
|------------|---------|
| IDs | UUID con `@PrimaryGeneratedColumn('uuid')` |
| Columnas BD | Español en `snake_case` vía `@Column({ name: '...' })` |
| Fechas automáticas | `@CreateDateColumn` / `@UpdateDateColumn` donde aplica |
| Enums | Archivos separados en `enums/` dentro de cada módulo |
| Registro entidades | `TypeOrmModule.forFeature([...])` en cada módulo |
| Exportación | Cada módulo exporta `TypeOrmModule` |
| Migraciones | No (solo `synchronize: true`) |

---

## Diagrama de relaciones entre módulos

```mermaid
erDiagram
    USUARIOS ||--o{ USUARIO_ROLES }o--|| ROLES

    DEPARTAMENTOS ||--o{ MUNICIPIOS
    MUNICIPIOS ||--o{ CORREGIMIENTOS
    CORREGIMIENTOS ||--o{ VEREDAS

    PROYECTOS ||--o{ ACTIVIDADES
    ACTIVIDADES ||--o{ SUBACTIVIDADES
    SUBACTIVIDADES ||--o{ PLANTILLAS_FORMULARIO
    PLANTILLAS_FORMULARIO ||--o{ CAMPOS_FORMULARIO

    PROYECTOS }o--o{ BENEFICIARIOS
    PROYECTOS }o--o{ ASOCIACIONES
    PROYECTOS }o--o{ INDICADORES

    VEREDAS ||--o{ BENEFICIARIOS
    VEREDAS ||--o{ ASOCIACIONES

    JORNADAS }o--|| PROYECTOS
    JORNADAS }o--|| ACTIVIDADES
    JORNADAS }o--o| SUBACTIVIDADES
    JORNADAS }o--|| VEREDAS
    JORNADAS }o--|| USUARIOS
    JORNADAS }o--o{ BENEFICIARIOS
    JORNADAS }o--o{ USUARIOS

    JORNADAS ||--o{ ENVIOS_FORMULARIO
    ENVIOS_FORMULARIO ||--o{ RESPUESTAS_FORMULARIO
    CAMPOS_FORMULARIO ||--o{ RESPUESTAS_FORMULARIO

    JORNADAS ||--o{ EVIDENCIAS
    INDICADORES ||--o{ REGISTROS_INDICADOR
    JORNADAS ||--o{ REGISTROS_INDICADOR
    USUARIOS ||--o{ REGISTROS_INDICADOR
```

---

## Módulos y entidades

### 1. usuarios

| Entidad | Tabla |
|---------|-------|
| `Usuario` | `usuarios` |
| `Rol` | `roles` |

**Enum `NombreRol`:** ADMINISTRADOR, COORDINADOR, TECNICO, VISUALIZADOR

**Relación:** Usuario ↔ Rol (ManyToMany) — tabla `usuario_roles`

---

### 2. territorios

Jerarquía: `Departamento → Municipio → Corregimiento → Vereda`

---

### 3. proyectos

**Enums:** `TipoProyecto`, `EstadoProyecto`

**Relaciones:** Actividad (1:N), Beneficiario (N:N), Asociacion (N:N), Indicador (N:N)

---

### 4. beneficiarios

**Enums:** `TipoDocumento`, `Genero`

**Relaciones:** Proyecto (N:N), Vereda (N:1)

---

### 5. asociaciones

**Relaciones:** Proyecto (N:N), Vereda (N:1)

---

### 6. actividades

`Actividad` (N:1 Proyecto) → `Subactividad` (N:1 Actividad)

---

### 7. jornadas

**Enum `EstadoJornada`:** PLANIFICADA, EN_PROGRESO, COMPLETADA, CANCELADA

**ManyToOne:** Proyecto, Actividad, Subactividad, Vereda, tecnicoResponsable (Usuario)

**ManyToMany:** Beneficiario (`jornada_beneficiarios`), equipo/Usuario (`jornada_equipo`)

---

### 8. formularios

Cadena: `Subactividad → PlantillaFormulario → CampoFormulario`

Captura: `Jornada → EnvioFormulario → RespuestaFormulario`

**Enum `TipoCampo`:** TEXTO, NUMERO, FECHA, SI_NO, SELECCION_UNICA, SELECCION_MULTIPLE, GPS, FOTO, FIRMA, ARCHIVO

**JSONB:** opciones, reglasValidacion, datosRaw, valorJson

---

### 9. evidencias

**Enum `TipoEvidencia`:** FOTO, VIDEO, DOCUMENTO, FIRMA

**Relación:** ManyToOne con Jornada

---

### 10. indicadores

**Enums:** `TipoIndicador`, `FrecuenciaIndicador`

`Indicador` (N:N Proyecto) → `RegistroIndicador` (N:1 Indicador, Jornada, Usuario)

---

## Tablas intermedias (ManyToMany)

| Tabla | Conecta |
|-------|---------|
| `usuario_roles` | usuarios ↔ roles |
| `proyecto_beneficiarios` | proyectos ↔ beneficiarios |
| `proyecto_asociaciones` | proyectos ↔ asociaciones |
| `indicador_proyectos` | indicadores ↔ proyectos |
| `jornada_beneficiarios` | jornadas ↔ beneficiarios |
| `jornada_equipo` | jornadas ↔ usuarios |

---

## Historial de sesiones

| Sesión | Fecha | Contenido |
|--------|-------|-----------|
| 01 | 2026-06-25 | Estructura base: 10 módulos, 22 entidades, TypeORM + PostgreSQL |
