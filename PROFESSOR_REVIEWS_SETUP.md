# Módulo de reseñas de profesores - Guía de despliegue y operación

Este documento contiene todo lo que debes hacer para ejecutar el módulo completo (migraciones, anti-spam, moderación, y validación manual).

## 1) Que se implemento

- Backend SQL en `supabase/migrations/0018_professor_reviews_module.sql`:
  - Tabla `public.professor_review` con validaciones fuertes.
  - Tabla `public.user_role` para roles de administracion.
  - Funcion `public.is_admin()`.
  - RPC de busqueda: `search_professor_review_stats`.
  - RPC de detalle publico con enmascarado: `get_professor_reviews_public`.
  - RPC de cola de moderación: `get_professor_reviews_for_moderation`.
  - RPC de moderación: `moderate_professor_review`.
  - RLS y políticas para lectura pública segura y moderación solo admin.
- Endurecimiento adicional en `supabase/migrations/0019_block_placeholder_professors_in_reviews.sql`:
  - Bloquea profesores placeholder/no reales (ej: `Sin profesor asignado`, `(SE IMPARTE EN IDIOMA INGLES)`).
  - Evita que puedan recibir reseñas en DB (trigger de insercion/actualizacion).
  - Excluye esos nombres de los RPC de listado, detalle y moderación.
- Edge Function anti-spam en `supabase/functions/submit-professor-review/index.ts`:
  - Verifica token de Cloudflare Turnstile.
  - Valida payload con Zod.
  - Inserta reseña en estado `pending`.
- Frontend:
  - Listado y filtros: `src/routes/app/professors/index.tsx`.
  - Detalle + paginación + formulario anónimo: `src/routes/app/professors/$professorId.tsx`.
  - Moderacion admin: `src/routes/app/professors/moderation.tsx`.
  - Navegacion agregada en sidebar.

## 2) Variables de entorno

Agrega estas variables en tu `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `SUPABASE_SECRET_KEY` (solo scripts/admin)
- `TURNSTILE_SECRET_KEY` (solo server/edge)

Referencias de ejemplo:

- `.env.example`
- `.env.production.local.example`

## 3) Como crear claves de Cloudflare Turnstile (gratis)

1. Entra a Cloudflare Dashboard > Turnstile.
2. Crea un site nuevo.
3. Define dominios permitidos:
   - Local: `localhost`
   - Produccion: tu dominio real.
4. Copia:
   - `site key` -> `VITE_TURNSTILE_SITE_KEY`
   - `secret key` -> `TURNSTILE_SECRET_KEY`

## 4) Ejecutar migraciones

En local:

```bash
bun run supabase:migrate
```

Si quieres reconstruir base local desde cero:

```bash
bun run supabase:reset
```

## 5) Desplegar y configurar Edge Function

Despliega la funcion:

```bash
supabase functions deploy submit-professor-review
```

Configura secretos para la funcion:

```bash
supabase secrets set TURNSTILE_SECRET_KEY=tu_secret_key
```

Nota: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` suelen estar disponibles en Edge Functions de Supabase. Si tu proyecto no las expone automaticamente, configuralas tambien como secrets.

## 6) Crear al menos un administrador para moderación

Inserta manualmente un rol admin:

```sql
insert into public.user_role (user_id, role)
values ('<uuid-del-usuario>', 'admin');
```

El UUID lo puedes obtener de `auth.users`.

## 7) Reglas de seguridad implementadas

- `professor_review`:
  - Insert directo desde cliente: bloqueado por RLS.
  - Select directo: solo `approved`.
  - Update para moderación: solo admin.
- `user_role`:
  - Usuario autenticado puede ver su propio rol.
  - Solo admin puede gestionar roles.
- Lectura publica con placeholder:
  - El RPC `get_professor_reviews_public` enmascara pendientes (`Comentario en revisión`) y oculta campos sensibles.

## 8) Validaciones y limites

- Comentario: 5 a 1000 caracteres.
- Puntajes (decimales): 0 a 10 para:
  - facilidad
  - calidad
  - claridad
  - justicia
- Engagement: entero de 1 a 5.
- Codigo de curso requerido (formato validado).
- Etiquetas permitidas por lista blanca.
- Coherencia profesor-curso validada en DB (debe existir relacion en oferta historica).

## 9) Filtros implementados en esta iteracion

- Busqueda por texto parcial/fuzzy (con `ILIKE` + `pg_trgm`).
- Promedio minimo.
- Mínimo de reseñas aprobadas.
- Codigo de curso.
- Solo profesores con reseñas aprobadas.

## 10) Checklist de prueba manual (paso a paso)

1. Busqueda parcial/fuzzy:
   - En `/app/professors`, escribe `Mau`.
   - Verifica coincidencias parciales (`Mauricio`, `Mauro`, etc.).
2. Tabla y filtros:
   - Ajusta promedio mínimo, mínimo reseñas y código de curso.
   - Verifica que la tabla cambia al escribir (debounce activo).
3. Detalle y paginacion:
   - Abre un profesor desde la tabla.
   - Cambia de pagina y verifica estados de carga/vacio.
4. Envio reseña anonima:
   - Completa formulario con curso valido + Turnstile.
   - Verifica mensaje de envio exitoso.
5. Pendiente oculta:
   - Revisa detalle publico tras enviar.
   - Debe verse `Comentario en revisión` sin puntajes reales.
6. Moderacion:
   - Entra a `/app/professors/moderation` con usuario admin.
   - Aprueba una reseña y valida visibilidad publica completa.
7. No autorizado:
   - Intenta moderar con usuario no admin.
   - Debe bloquearse.

## 11) Comando de validacion de build

```bash
bun run build
```

## 12) Supuestos importantes

- El proyecto ya tiene tablas `professor` y `course` pobladas.
- Hay historial de oferta (`course_offering*`) para validar relacion profesor-curso.
- Se usa Supabase con RLS activo y acceso por publishable key en frontend.
