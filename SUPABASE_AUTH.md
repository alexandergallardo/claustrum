# Supabase Auth (guía para implementar en este repo con acceso de invitados)

Objetivo: implementar **login**, **signup**, **perfil (Account)** y **logout** con Supabase, manteniendo que **`/app` sea accesible para invitados** (sin guard obligatorio), pero conservando **sesión** cuando el usuario sí inicia sesión.

Esta guía está escrita para que una IA pueda aplicar los cambios directamente en el código del repo, usando utilidades existentes y el modelo de llaves **publishable** (no `anon`).

---

## 0) Reglas de implementación (importantes)

- **NO** bloquear `/app` detrás de auth. `/app` debe abrir para invitados.
- **SÍ** mantener sesión cuando el usuario inicia sesión:
  - Usar el cliente existente `getSupabaseBrowserClient()` que ya tiene `persistSession: true`.
- **NO** crear un cliente extra de Supabase. Reutiliza:
  - `src/lib/supabase/browser-client.ts`
- **Logout**: se realiza desde el menú del usuario (sidebar), no existe ruta `/logout`.
- El perfil (Account) debe existir como ruta: `/account`.
- La UI del sidebar (NavUser) no debe quedar “hardcodeada” al usuario ficticio; debe reflejar sesión real o estado invitado.

---

## 1) Variables de entorno (publishable)

Configura estas variables (públicas, para browser):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Este repo ya valida estas variables en:

- `src/lib/env/public.ts`

Notas:
- **No usar `anon key`**.
- `SUPABASE_SECRET_KEY` existe sólo para operaciones server/admin y no es parte del flujo de login/signup del usuario (no usarlo desde el browser).

---

## 2) Cliente Supabase (ya existe)

Para Auth desde UI usa:

- `getSupabaseBrowserClient()` desde `src/lib/supabase/browser-client.ts`

Este cliente ya está configurado con:

- `persistSession: true`
- `autoRefreshToken: true`
- `detectSessionInUrl: true`

---

## 3) Implementar Login (email/password)

### Archivos involucrados

- UI de la ruta ya existe:
  - `src/routes/login/index.tsx` (renderiza `LoginForm`)
- Implementar lógica real aquí:
  - `src/components/login-form.tsx`

### Cambios requeridos en `LoginForm`

1) Convertir inputs a controlados:
- `email`
- `password`

2) En `onSubmit`:
- prevenir submit
- setear estado `isSubmitting`
- limpiar error previo
- llamar:

- `const supabase = getSupabaseBrowserClient()`
- `const { error } = await supabase.auth.signInWithPassword({ email, password })`

3) Manejar error:
- si `error` existe, mostrar mensaje legible en la UI (sin navegar)

4) Si es exitoso:
- navegar a `"/app"` con `useNavigate()`

5) UX mínimo:
- botón deshabilitado mientras `isSubmitting`
- mostrar error debajo del form o arriba del botón

Resultado esperado:
- credenciales válidas => entra a `/app`
- credenciales inválidas => muestra error, no navega

---

## 4) Implementar Signup (email/password)

### Archivos involucrados

- UI de la ruta ya existe:
  - `src/routes/signup/index.tsx` (renderiza `SignupForm`)
- Implementar lógica real aquí:
  - `src/components/signup-form.tsx`

### Cambios requeridos en `SignupForm`

1) Convertir inputs a controlados:
- `name`
- `email`
- `password`
- `confirmPassword`

2) Validación cliente:
- si `password !== confirmPassword`, mostrar error y abortar submit

3) En `onSubmit`:
- `const supabase = getSupabaseBrowserClient()`
- llamar:

- `const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })`

4) Manejo de resultados:
- si `error` existe => mostrar mensaje y no navegar
- si es exitoso:
  - si hay sesión inmediata (`data.session` existe) => navegar a `"/app"`
  - si NO hay sesión (p.ej. confirmación por email) => mostrar un mensaje “Revisa tu correo para confirmar la cuenta” y NO asumir que el usuario ya está logueado

5) UX mínimo:
- `isSubmitting`, disabled button
- mensajes claros de error/éxito

Resultado esperado:
- registro exitoso con sesión inmediata => entra a `/app`
- registro exitoso con confirmación => se informa al usuario y se queda en la pantalla

---

## 5) Mantener `/app` accesible a invitados

### Requerimiento

- **NO** agregar `beforeLoad` para redirigir a `/login` en:
  - `src/routes/app/_index.tsx`

`/app` debe renderizarse siempre.

### Comportamiento esperado

- Invitado (sin sesión) puede entrar a `/app` y usar funcionalidades “guest”.
- Usuario con sesión también entra a `/app`, y la UI mostrará su info.

---

## 6) Página de perfil: `/account` (para logged-in y guest)

### Requerimiento

Crear/asegurar la ruta:

- `src/routes/account/index.tsx` (route: `"/account"`)

La página debe:
- leer usuario con Supabase:
  - `supabase.auth.getUser()`
- suscribirse a cambios:
  - `supabase.auth.onAuthStateChange(...)`
- renderizar dos estados:
  1) **Logueado**: mostrar email, user id, provider (mínimo)
  2) **Invitado**: texto “No estás logueado” + botones a `/login` y `/signup`

Importante:
- Esta página NO debe redirigir: también es visible para invitados.

---

## 7) Sidebar/User menu: reflejar sesión real (no hardcode)

Actualmente el sidebar usa un usuario hardcodeado (ej. “shadcn”). Para soportar invitados y sesión real:

### 7.1) Ajustar `AppSidebar` para usar Supabase real

Archivo:
- `src/components/app-sidebar.tsx`

Implementación requerida:

1) Reemplazar el `data.user` hardcodeado por estado real:
- crear state:
  - `const [authUser, setAuthUser] = useState<User | null>(null)`
  - `const [isAuthReady, setIsAuthReady] = useState(false)`

2) En `useEffect` al montar:
- `const supabase = getSupabaseBrowserClient()`
- `supabase.auth.getUser()` para inicializar:
  - set `authUser`
  - set `isAuthReady = true`
- suscribirse a:
  - `supabase.auth.onAuthStateChange((_event, session) => setAuthUser(session?.user ?? null))`
- cleanup: `unsubscribe`

3) Render del footer:
- si `isAuthReady` aún false => puedes ocultar el menú o mostrar placeholder
- si `authUser` existe => renderiza `NavUser` con valores reales:
  - name: `authUser.user_metadata?.full_name ?? authUser.email ?? "User"`
  - email: `authUser.email ?? ""`
  - avatar: si no existe en metadata, usa un fallback (p.ej. `""` y dejar que `AvatarFallback` actúe)

- si `authUser` es null (invitado) => renderiza también `NavUser`, pero en modo guest:
  - name: `"Guest"`
  - email: `""` (o `"Not signed in"`)
  - avatar: `""`

Nota:
- No crear un componente nuevo si no hace falta; pero es válido adaptar `NavUser` para que soporte `email` vacío.

### 7.2) Conectar menu item “Account” y remover “Billing”

Archivo:
- `src/components/nav-user.tsx`

Requerimientos:
1) “Account” debe navegar a `/account` usando TanStack Router (`Link`).
2) Eliminar por completo el item “Billing” (texto e ícono).
3) Mantener “Notifications” si quieres, pero no tocarlo si no es parte del requerimiento.
4) “Log out” debe estar presente. Ver siguiente sección.

---

## 8) Logout desde el sidebar (única forma)

Archivo:
- `src/components/nav-user.tsx`

Requerimiento:
- Al presionar “Log out”:
  1) `const supabase = getSupabaseBrowserClient()`
  2) `await supabase.auth.signOut()`
  3) navegar a la landing (idealmente `"/"` o ruta index) o permanecer en la página actual si prefieres.
     - En este repo existe la landing `/_index` y se accede con `"/"`.

Comportamiento esperado:
- la sesión se elimina
- como `/app` es público, el usuario puede seguir en `/app` pero el menú pasa a “Guest”
- `/account` muestra el estado de invitado

---

## 9) Validación final (manual)

1) Arrancar app y verificar que `/app` abre sin login.
2) Ir a `/login`, iniciar sesión:
- debe navegar a `/app`
- el sidebar debe mostrar datos del usuario (no hardcode)
3) Ir a `/account`:
- logueado => ver email/id/provider
4) Click “Log out” desde el menú de usuario:
- sesión se cierra
- sidebar pasa a “Guest”
- `/account` muestra estado invitado
5) Ir a `/signup`:
- registrar usuario nuevo
- si hay confirmación por email: muestra mensaje y se queda en signup
- si no hay confirmación: entra a `/app`

---

## 10) Archivos que una IA debe tocar (lista final)

- `src/components/login-form.tsx` (implementar `signInWithPassword`)
- `src/components/signup-form.tsx` (implementar `signUp` + validación confirm password)
- `src/routes/account/index.tsx` (crear o ajustar página de perfil visible también para invitados)
- `src/components/app-sidebar.tsx` (reemplazar usuario hardcode por lectura real de sesión + modo guest)
- `src/components/nav-user.tsx` (Account -> `/account`, quitar Billing, implementar Logout con `signOut`)

Regla:
- No agregar guard/redirecciones que bloqueen `/app`.