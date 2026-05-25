# Claustrum

Plataforma web open-source para estudiantes del Instituto Tecnológico de Costa Rica. Centraliza información académica: horarios, malla curricular, cursos, profesores, evaluaciones, progreso académico y configuración del perfil estudiantil.

El proyecto no está afiliado, respaldado ni representa oficialmente al Instituto Tecnológico de Costa Rica. Es una iniciativa independiente distribuida bajo licencia MIT.

## Tabla de contenidos

- [Características](#características)
- [Stack técnico](#stack-técnico)
- [Arquitectura del repositorio](#arquitectura-del-repositorio)
- [Requisitos](#requisitos)
- [Configuración inicial](#configuración-inicial)
- [Variables de entorno](#variables-de-entorno)
- [Comandos disponibles](#comandos-disponibles)
- [Entorno de desarrollo](#entorno-de-desarrollo)
- [Base de datos](#base-de-datos)
- [Autenticación](#autenticación)
- [API Worker](#api-worker-claustrum-api)
- [Pipeline de datos TEC](#pipeline-de-datos-tec)
- [Rutas principales](#rutas-principales)
- [Convenciones de código](#convenciones-de-código)
- [Despliegue](#despliegue)
- [Cómo contribuir](#cómo-contribuir)
- [Licencia](#licencia)

## Características

- Dashboard académico con resumen de progreso del estudiante.
- Selección de universidad, campus, carrera y plan de estudios durante onboarding.
- Visualización de malla curricular, cursos, requisitos, correquisitos y equivalencias.
- Exploración de horarios y grupos disponibles por periodo académico.
- Búsqueda y detalle de profesores.
- Reseñas de profesores con moderación y protección anti-spam mediante Cloudflare Turnstile.
- Carga, visualización y moderación de evaluaciones en PDF.
- Almacenamiento de archivos de evaluaciones en Cloudflare R2 mediante un Worker dedicado.
- Autenticación con Better Auth: correo, magic link, recuperación de contraseña, Google OAuth y 2FA.
- Temas claro, oscuro y sistema mediante `next-themes`.

## Stack técnico

- Runtime y gestor de paquetes: pnpm.
- Frontend: React 19, TypeScript, Vite 8.
- Enrutamiento: TanStack Router con rutas basadas en archivos.
- Obtención de datos y caché: TanStack Query.
- UI: Tailwind CSS v4, shadcn/ui, Radix UI, Lucide, Tabler Icons.
- Autenticación: Better Auth con magic link, 2FA y JWT.
- Base de datos: Supabase PostgreSQL con RLS y RPCs.
- Infraestructura de archivos: Cloudflare Workers y Cloudflare R2.
- Despliegue del frontend: Cloudflare Pages.
- Protección antiabuso: Cloudflare Turnstile.
- Pipeline de datos académicos: CLI Python en `supabase/tec-data` con `uv`.

## Arquitectura del repositorio

```txt
.
├── src/
│   ├── components/              # Componentes de aplicación y UI reutilizable
│   ├── lib/                     # Clientes, hooks, tipos, API helpers y utilidades
│   ├── routes/                  # Rutas file-based de TanStack Router
│   ├── main.tsx                 # Entrada de React
│   ├── router.tsx               # Configuración del router
│   └── styles.css               # Estilos globales con Tailwind CSS v4
├── supabase/
│   ├── migrations/              # Migraciones SQL de esquema, RLS y RPCs
│   ├── tec-data/                # CLI para descargar/procesar datos académicos
│   └── config.toml              # Configuración local de Supabase
├── workers/
│   └── api/                     # API Worker unificado (evaluaciones, reseñas, auth)
├── .github/workflows/           # CI/CD: preview, producción y seed-history
├── components.json              # Configuración de shadcn/ui
├── vite.config.ts               # Configuración de Vite y code splitting
├── tsconfig.json                # Configuración TypeScript estricta
└── package.json                 # Scripts y dependencias del frontend
```

## Requisitos

- pnpm instalado.
- Docker si se va a levantar Supabase localmente.
- Cuenta/proyecto de Supabase para usar datos remotos o configurar producción.
- Cuenta de Cloudflare si se va a desplegar Pages, Worker o R2.
- Python 3.14+ y `uv` solo si se va a trabajar con el pipeline `supabase/tec-data`.

## Configuración inicial

1. Instalar dependencias:

```bash
pnpm install
```

2. Crear archivo de entorno local:

```bash
cp .env.example .env.local
```

3. Completar las variables requeridas en `.env.local`.

4. Si se usará Supabase local, iniciar los servicios:

```bash
pnpm run supabase:start
```

5. Ejecutar migraciones si aplica:

```bash
pnpm run supabase:migrate
```

6. Iniciar la aplicación web:

```bash
pnpm run dev
```

La app queda disponible en `http://localhost:3000`.

## Variables de entorno

El frontend usa variables públicas con prefijo `VITE_`. Las credenciales privilegiadas no deben exponerse en código cliente ni confirmarse en Git.

| Variable                        | Uso                                            | Obligatoria                                                |
| ------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | URL base del proyecto Supabase, sin `/rest/v1` | Sí                                                         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key pública para el cliente web    | Sí                                                         |
| `VITE_TURNSTILE_SITE_KEY`       | Site key pública de Cloudflare Turnstile       | No, requerida para flujos con captcha                      |
| `VITE_API_BASE_URL`             | URL base del API Worker (`claustrum-api`)      | No, requerida para subir/ver evaluaciones y enviar reseñas |
| `SUPABASE_SECRET_KEY`           | Credencial de servidor para scripts/admin      | No en frontend, requerida para operaciones privilegiadas   |
| `TURNSTILE_SECRET_KEY`          | Secret key de servidor de Turnstile            | Requerida en API Worker con captcha                        |
| `BETTER_AUTH_SECRET`            | Secret key de Better Auth                      | Sí (producción)                                            |
| `BETTER_AUTH_URL`              | URL base para enlaces de auth                  | Sí (producción)                                            |

Archivos de referencia:

- `.env.example`: plantilla para desarrollo local.
- `.env.production.local.example`: plantilla para credenciales de producción local; no debe confirmarse en Git.
- `workers/api/.dev.vars`: variables locales del Worker, ignorado por Git.

## Comandos disponibles

Todos los comandos del proyecto principal deben ejecutarse con pnpm.

| Comando                     | Descripción                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `pnpm install`              | Instala dependencias según `pnpm-lock.yaml`                           |
| `pnpm run dev`              | Inicia Vite en `http://localhost:3000`                                |
| `pnpm run build`            | Ejecuta `tsc` y genera build de producción en `dist/`                 |
| `pnpm run preview`          | Sirve localmente el build de producción                               |
| `pnpm run supabase:start`   | Levanta Supabase local                                                |
| `pnpm run supabase:stop`    | Detiene Supabase local                                                |
| `pnpm run supabase:status`  | Muestra estado y credenciales locales de Supabase                     |
| `pnpm run supabase:migrate` | Aplica migraciones pendientes                                         |

## Entorno de desarrollo

```bash
pnpm install
cp .env.example .env.local
pnpm run supabase:start
pnpm run supabase:migrate
pnpm run dev
```

Notas importantes:

- No uses `npm`, `npx`, `bun` ni `yarn` en este repositorio.
- No confirmes en Git archivos `.env`, `.env.local`, `.dev.vars`, `dist/`, `.wrangler/`, `node_modules/` ni datos generados.
- El servidor de desarrollo usa Vite en el puerto `3000`.
- Las importaciones internas deben usar el alias `@/`, configurado en `tsconfig.json`.

## Base de datos

Supabase PostgreSQL se utiliza como base de datos principal. `supabase/migrations/` contiene las migraciones SQL versionadas para esquema, políticas RLS y RPCs.

La app consume tablas, vistas y RPCs para:

- Catálogo académico: universidades, campus, carreras, planes, cursos y periodos.
- Perfil académico del usuario.
- Malla curricular y relaciones entre cursos.
- Horarios y grupos ofertados.
- Profesores y reseñas.
- Evaluaciones, archivos y estado de moderación.
- Sincronización de datos: ledger de seeds aplicados.

Las consultas principales están en `src/lib/api.ts`, `src/lib/hooks/use-queries.ts`, `src/lib/evaluations/api.ts` y `src/lib/professor-reviews/api.ts`.

## Autenticación

La autenticación se maneja con [Better Auth](https://better-auth.com). El cliente de frontend se configura en `src/lib/auth/client.ts` e incluye:

- Inicio de sesión con correo y contraseña.
- Registro de cuenta.
- Magic link (acceso sin contraseña).
- Verificación de correo electrónico.
- Recuperación y restablecimiento de contraseña.
- Google OAuth.
- 2FA (autenticación de dos factores) con TOTP.
- Sesiones persistentes con JWT.

El servidor Better Auth corre dentro del API Worker (`workers/api`). La configuración del servidor está en `workers/api/src/auth.ts`.

## API Worker (`claustrum-api`)

El Worker ubicado en `workers/api` es el backend unificado de la aplicación. Maneja autenticación (Better Auth), evaluaciones (PDF en R2) y reseñas de profesores.

### Endpoints

| Método | Ruta                        | Descripción                                                |
| ------ | --------------------------- | ---------------------------------------------------------- |
| `POST` | `/evaluations/upload`       | Sube PDF de evaluación y, opcionalmente, PDF de respuestas |
| `GET`  | `/evaluations/file?key=...` | Sirve/streaming de PDF si el usuario tiene permiso         |
| `POST` | `/evaluations/moderate`     | Aprueba o rechaza evaluaciones, solo administradores       |
| `POST` | `/professor-reviews`        | Envía una reseña de profesor (con Turnstile)               |
| `*`    | `/auth/*`                   | Rutas de Better Auth (sesión, registro, 2FA, etc.)        |

### Seguridad

- Verifica JWT de Better Auth recibido por `Authorization: Bearer <token>`.
- Verifica Cloudflare Turnstile en cargas de evaluaciones y envío de reseñas.
- Limita archivos a PDF y máximo 10 MB por archivo.
- Valida permisos para archivos pendientes/rechazados.
- Usa roles de la tabla `user_role` para moderación administrativa.
- Bloquea reseñas para profesores placeholder.

### Comandos del Worker

Ejecutar desde `workers/api`:

```bash
pnpm install
pnpm run dev
pnpm run deploy
```

Configuración principal:

- `workers/api/wrangler.jsonc`
- Binding R2: `EVALUATIONS_BUCKET`
- Bucket: `claustrum-evaluations`
- Nombre Worker: `claustrum-api`

Variables requeridas para el Worker:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `TURNSTILE_SECRET_KEY`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

## Pipeline de datos TEC

El directorio `supabase/tec-data` contiene una CLI en Python para descargar, procesar, generar SQL y sincronizar datos académicos del TEC.

Requisitos específicos:

- Python 3.14+
- `uv`

Instalación:

```bash
cd supabase/tec-data
uv sync
```

Flujo resumido:

```bash
uv run tec-data download
uv run tec-data process
uv run tec-data download --scope catalog
uv run tec-data process --scope catalog
uv run tec-data download --scope offering --years 2026
uv run tec-data process --scope offering --years 2026
uv run tec-data sql
```

Sincronización completa con generación de seed delta:

```bash
uv run tec-data sync --target seed-history --seed-dir ../seeds/tec-data --scope offering --years 2026 --no-apply
uv run tec-data sync --target local --years 2026
uv run tec-data sync --target remote --years 2026 --env-file ../../.env.production.local
```

Consulta `supabase/tec-data/README.md` para el detalle completo de dependencias entre entidades y comandos avanzados.

## Rutas principales

Las rutas se generan desde `src/routes` con TanStack Router.

| Ruta                       | Propósito                          |
| -------------------------- | ---------------------------------- |
| `/`                        | Dashboard principal                |
| `/onboarding`              | Configuración académica inicial    |
| `/auth/signin`             | Inicio de sesión                   |
| `/auth/signup`             | Registro                           |
| `/auth/magic-link`         | Acceso por magic link              |
| `/auth/reset-password`     | Restablecimiento de contraseña     |
| `/auth/verify-email`       | Verificación de correo             |
| `/curriculum`              | Malla curricular                   |
| `/curriculum/$courseId`    | Detalle de curso                   |
| `/schedule`                | Horarios y grupos                  |
| `/professors`              | Búsqueda/listado de profesores     |
| `/professors/$professorId` | Detalle y reseñas de profesor      |
| `/professors/moderation`   | Moderación de reseñas              |
| `/evaluations/view`        | Visualización de evaluaciones      |
| `/evaluations/moderation`  | Moderación de evaluaciones         |
| `/policies`                | Políticas/información del proyecto |
| `/settings`                | Configuración del usuario          |
| `/settings/profile`        | Perfil                             |
| `/settings/security`       | Seguridad                          |
| `/settings/appearance`     | Apariencia                         |

`src/routes/__root.tsx` aplica el layout global, controla redirecciones de onboarding y renderiza el `Toaster`. Las rutas públicas principales son `/auth/*` y `/onboarding`; el resto usa `AppLayoutWrapper`.

## Convenciones de código

- Usar TypeScript estricto.
- Usar componentes funcionales y hooks de React.
- Usar `@/` para imports desde `src/`.
- Mantener componentes pequeños y enfocados.
- Preferir componentes existentes en `src/components/ui` antes de crear nuevos.
- Usar `cn()` desde `@/lib/utils` para clases condicionales.
- Mantener archivos no-componentes en `kebab-case` y componentes en `PascalCase`.
- No introducir `any`; usar tipos explícitos, genéricos o `unknown` cuando sea necesario.
- No editar manualmente `src/routeTree.gen.ts`; lo genera TanStack Router.

## Despliegue

El despliegue está automatizado con GitHub Actions y Cloudflare.

### Preview

Flujo: `.github/workflows/preview.yml`

- Se ejecuta al hacer push a `development`.
- Instala dependencias con pnpm.
- Ejecuta `pnpm run build`.
- Publica `dist/` en Cloudflare Pages con branch `development`.

### Producción

Flujo: `.github/workflows/production.yml`

- Se ejecuta al hacer push a `main`.
- Instala dependencias con pnpm.
- Ejecuta `pnpm run build`.
- Despliega el Worker `workers/api`.
- Publica `dist/` en Cloudflare Pages con proyecto `claustrum`.

### Seed-history (TEC Data)

Flujo: `.github/workflows/tec-data-seed-history.yml`

- Se ejecuta semanalmente (lunes 7:00 UTC) o manualmente.
- Levanta PostgreSQL efímero como service container.
- Replayea seeds históricos y genera delta de offering.
- Si hay cambios, abre un PR a `development`.

### Secretos requeridos en GitHub Actions

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_API_BASE_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Cómo contribuir

1. Crea una rama desde `development`:

```bash
git checkout development
git pull
git checkout -b feat/descripcion-corta
```

2. Instala dependencias y configura el entorno:

```bash
pnpm install
cp .env.example .env.local
```

3. Implementa los cambios siguiendo las convenciones del proyecto.

4. Verifica que el build pase:

```bash
pnpm run build
```

5. Revisa los cambios antes de confirmarlos en Git:

```bash
git status
git diff
```

6. Usa commits claros, preferiblemente con el estilo Conventional Commits:

```bash
git commit -m "feat: agregar filtro de horarios por campus"
```

7. Abre un pull request hacia `development` con:

- Resumen del cambio.
- Contexto o problema que resuelve.
- Evidencia de verificación, por ejemplo `pnpm run build`.
- Capturas si el cambio afecta UI.
- Notas de migración si toca base de datos, Worker, variables de entorno o datos.

## Buenas prácticas para PRs

- Mantener cambios pequeños y revisables.
- Separar cambios de UI, datos, migraciones e infraestructura cuando sea razonable.
- Documentar nuevas variables de entorno en `.env.example`.
- Incluir migraciones SQL para cambios de esquema.
- No confirmar en Git secretos, builds generados, cachés ni datos descargados.
- Validar permisos/RLS cuando se agreguen tablas, vistas o RPCs.
- Confirmar que los flujos con Turnstile funcionen cuando se modifiquen reseñas o evaluaciones.

## Licencia

Este proyecto está distribuido bajo licencia MIT. Consulta `LICENSE` para ver el texto completo.
