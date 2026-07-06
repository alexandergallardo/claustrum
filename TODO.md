# Plan de Migración a TanStack Start y Optimización SEO

Este documento detalla paso a paso cómo migrar Claustrum de una SPA en Vite (TanStack Router) a una aplicación Full-Stack con SSR (TanStack Start) desplegada en Cloudflare Workers, sin afectar el Worker existente de la API.

## FASE 1: Preparación y Dependencias

**Objetivo:** Instalar las librerías necesarias de TanStack Start y ajustar el `package.json`.

1. **Instalar nuevas dependencias:**

   ```bash
   pnpm add @tanstack/react-start vinxi
   pnpm add -D @tanstack/start-vite-plugin @tanstack/start-router-manifest
   ```

2. **Actualizar dependencias de TanStack:**
   Asegúrate de que `@tanstack/react-router` y `@tanstack/react-start` estén en la misma versión (idealmente la última versión beta o estable).

## FASE 2: Configuración del Proyecto y Vite

**Objetivo:** Adaptar Vite para que use Vinxi (el motor de compilación de Start) y configure la salida para Cloudflare Workers.

1. **Modificar `vite.config.ts` (o crear `app.config.ts`):**
   TanStack Start prefiere un archivo `app.config.ts`. Debemos configurar el servidor de salida (Nitro) para Cloudflare Workers.

   ```typescript
   // app.config.ts
   import { defineConfig } from "@tanstack/react-start/config";
   import tsConfigPaths from "vite-tsconfig-paths";
   import tailwindcss from "@tailwindcss/vite";

   export default defineConfig({
     server: {
       preset: "cloudflare-module", // Generará salida compatible con Cloudflare Workers
     },
     vite: {
       plugins: [
         tsConfigPaths({
           projects: ["./tsconfig.json"],
         }),
         tailwindcss(),
       ],
     },
   });
   ```

2. **Reestructurar la entrada de la aplicación:**
   Divide tu actual `src/main.tsx` en `client.tsx` y `server.tsx` en el directorio `app/` o `src/` (según tu convención):
   - **`src/client.tsx`**

     ```typescript
     import { StartClient } from '@tanstack/react-start'
     import { hydrateRoot } from 'react-dom/client'
     import { createRouter } from './router'

     const router = createRouter()
     hydrateRoot(document.getElementById('root')!, <StartClient router={router} />)
     ```

   - **`src/server.tsx`**

     ```typescript
     import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
     import { createRouter } from "./router";

     export default createStartHandler({
       createRouter,
       getRouterManifest: () => import("@tanstack/start-router-manifest"),
     })(defaultStreamHandler);
     ```

## FASE 3: Implementación de SEO en las Rutas

**Objetivo:** Aprovechar SSR inyectando `<Meta>` en las rutas, en lugar de usar el `index.html` estático.

1. **En `src/routes/__root.tsx`:**
   Elimina el `index.html` estático antiguo y renderiza el HTML desde React.

   ```tsx
   import { Outlet, createRootRoute } from "@tanstack/react-router";
   import { Meta, Scripts } from "@tanstack/react-start";

   export const Route = createRootRoute({
     component: RootComponent,
   });

   function RootComponent() {
     return (
       <html lang="es">
         <head>
           <Meta />
         </head>
         <body>
           <Outlet />
           <Scripts />
         </body>
       </html>
     );
   }
   ```

2. **Inyectar Meta Tags Específicos:**
   En cada ruta importante (`_index.lazy.tsx` o `schedule.tsx`), define la propiedad `head` u opciones equivalentes del router para definir los tags. Para que no haya redirecciones a `/schedule` en la raíz (para que Google vea la landing o el schedule con los metadatos correctos), colócalos así:
   ```tsx
   export const Route = createFileRoute("/schedule")({
     head: () => ({
       meta: [
         { title: "Generador y Creador de Horarios TEC (ITCR) | Claustrum" },
         {
           name: "description",
           content:
             "El mejor creador de horarios para el Tecnológico de Costa Rica. Arma tu horario, evalúa profesores y más.",
         },
       ],
     }),
     // ...
   });
   ```

## FASE 4: Configuración de Cloudflare Workers (Reemplazando Pages)

**Objetivo:** Configurar `wrangler` para desplegar el servidor SSR, asegurando convivencia con el worker de API.

1. **Crear `wrangler.jsonc` en la raíz del proyecto:**
   Cloudflare permite que una ruta más específica (`/api/*`) tome precedencia sobre una más genérica (`/*`). El frontend manejará `/*`.

   ```jsonc
   {
     "$schema": "node_modules/wrangler/config-schema.json",
     "name": "claustrum-web",
     "main": "./.output/server/index.mjs", // Ruta generada por Nitro (TanStack Start)
     "compatibility_date": "2024-04-01",
     "compatibility_flags": ["nodejs_compat"],
     "routes": [
       {
         "pattern": "claustrum.maugp.com/*",
         "zone_name": "maugp.com",
       },
     ],
     "observability": {
       "enabled": true,
     },
   }
   ```

2. **Asegurar que la API tenga precedencia:**
   Verifica que el Worker de la API (en `/workers/api`) tenga en su `wrangler.jsonc` (o equivalente):
   ```jsonc
   "routes": [
     {
       "pattern": "claustrum.maugp.com/api/*",
       "zone_name": "maugp.com"
     }
   ]
   ```
   _Nota: Cloudflare enruta automáticamente al patrón más largo, por lo que `/api/_`siempre ganará sobre`/_`._

## FASE 5: Actualización del CI/CD (GitHub Actions)

**Objetivo:** Cambiar el pipeline de Cloudflare Pages a Cloudflare Workers con inyección de variables de entorno.

Modificar `.github/workflows/production.yml`:

1. **Reemplazar el paso de Pages:**

   ```yaml
   - name: Build TanStack Start (SSR)
     env:
       VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
       VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
       VITE_TURNSTILE_SITE_KEY: ${{ secrets.VITE_TURNSTILE_SITE_KEY }}
       VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
     run: pnpm run build # Asumiendo que ahora hace 'vinxi build'

   - name: Deploy Frontend to Cloudflare Workers
     uses: cloudflare/wrangler-action@v3
     with:
       apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
       accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
       command: deploy
       # Wrangler leerá wrangler.jsonc de la raíz automáticamente
   ```

2. **Manejo de Secretos/Entorno:**
   Para las variables en el Worker que se ocupan en SSR, es mejor pasarlas por el entorno de Cloudflare y leerlas usando `env` en el manejador del backend, o inyectarlas durante el build time si siguen prefijadas con `VITE_`. (Vite reemplazará las variables `VITE_` durante `vinxi build`).

## FASE 6: Transición Manual y Limpieza (Cloudflare Dashboard)

**Atención (Intervención Manual Requerida):**

1. Como actualmente tienes el dominio `claustrum.maugp.com` asignado a un proyecto de **Cloudflare Pages**, al intentar desplegar un **Worker** con esa misma ruta personalizada habrá un conflicto de DNS/Routing en Cloudflare.
2. **Paso de transición:**
   - Una vez que hayas verificado localmente que el build de SSR funciona.
   - Ve al Cloudflare Dashboard -> Pages -> "Claustrum" -> Custom Domains.
   - **Elimina** el Custom Domain `claustrum.maugp.com` del proyecto Pages.
   - Luego el GitHub Action (con `wrangler deploy`) creará la nueva ruta hacia el Worker `claustrum-web`.
3. Borra el proyecto de Cloudflare Pages cuando ya no sea necesario.

---

**Siguiente Paso:**
Sigue estas instrucciones para refactorizar la base del código. El UI se mantendrá intacto, pero ahora Cloudflare y Google verán tu aplicación lista para indexar con las etiquetas correctas de "Generador" y "Creador".
