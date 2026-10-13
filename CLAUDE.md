# Ruralia backend — guía para agentes

NestJS + TypeORM 1.x + PostgreSQL. Las convenciones generales (sin emojis, etc.) están en `../claude.md`.

## Consultas con TypeORM (obligatorio)

Estas reglas existen porque el listado y el detalle de proyectos llegaron a tardar varios segundos en producción: un solo `findOne` del proyecto "El Carmen de Bolívar" (1211 beneficiarios, 67 personas, 4 actividades) devolvía 324.548 filas por producto cartesiano.

### 1. Nunca unir dos o más colecciones en la misma consulta
- No combinar en un mismo `find({ relations })` ni en la misma cadena de `leftJoinAndSelect` dos o más relaciones `OneToMany` / `ManyToMany` hermanas (p. ej. `personal` + `proyectoBeneficiarios` + `veredas` + `actividades`). SQL devuelve una fila por cada combinación: las filas se multiplican (`1211 x 67 x 4`).
- Unir relaciones `ManyToOne` / `OneToOne` sí es seguro (`creador`, `pb.beneficiario`, `pb.reemplazaA`): no multiplican filas.
- Una cadena anidada de colecciones (actividad -> subactividades -> procesos -> metas) es aceptable si el volumen es pequeño, pero no añadir colecciones hermanas en ningún nivel.

### 2. Cargar cada colección en su propia consulta, en paralelo
- Patrón de referencia: `cargarProyectosConVinculos` en `src/proyectos/proyectos.service.ts`. Una consulta por colección filtrada con `IN (:...ids)`, todas dentro de `Promise.all`, y luego se arma el objeto en memoria.
- No confiar en `relationLoadStrategy: 'query'` para esto: en Postgres TypeORM ejecuta esas consultas en serie sobre una sola conexión, y el tiempo total es la suma de todas.
- Las consultas independientes de un mismo endpoint (permisos, datos, conteos, avance) van en `Promise.all`, no con `await` uno tras otro.

### 3. Paginación sin JOINs a colecciones
- `skip/take` + `getManyAndCount` con colecciones unidas hace que TypeORM ejecute la consulta pesada hasta tres veces (DISTINCT de ids, datos, COUNT).
- Patrón: paginar y contar solo sobre la tabla principal (los filtros por vínculos con `EXISTS (...)`), y después cargar el detalle solo para los ids de la página. Referencias: `ProyectosService.listar` y `JornadasService.listar`.

### 4. Nada de N+1
- No llamar a un método que consulta la BD dentro de `proyectos.map(...)` o de un `for`. Calcular en lote para todos los ids (p. ej. `ActividadesService.obtenerProgresoPorProyectos`, `sumarEjecutadoPorProyectos`) o con un `GROUP BY`.

### 5. Traer solo lo que se usa
- Si un cálculo no necesita una relación, no cargarla (p. ej. el avance no necesita `periodos` ni `completadaPor`: ver `cargarArbolProgreso`).
- Si la vista del usuario es limitada (técnico), no cargar vínculos ni avance que luego se descartan.

### 6. Índices en llaves foráneas
- Postgres no indexa automáticamente las columnas FK de relaciones `ManyToOne`. Toda FK por la que se filtre o se una (`proyecto_id`, `meta_id`, `jornada_id`...) debe tener `@Index('IDX_tabla_columna', ['relacion'])` en la entidad.
- `synchronize: true` está activo: los índices nuevos se crean al arrancar contra la BD configurada en `.env`, incluida producción si el entorno local apunta a ella.

### Checklist antes de dar por buena una consulta
1. ¿Hay más de una colección (`OneToMany` / `ManyToMany`) en la misma consulta? Separarlas.
2. ¿Hay `await` de consultas independientes en serie? Pasarlas a `Promise.all`.
3. ¿Hay una consulta dentro de un bucle? Hacerla en lote.
4. ¿La paginación arrastra JOINs a colecciones? Paginar ids primero.
5. ¿Las columnas de filtro/JOIN tienen índice?
