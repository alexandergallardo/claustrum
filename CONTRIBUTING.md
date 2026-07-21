# Guía de contribución

¡Gracias por tu interés en contribuir a Claustrum! Para mantener el código limpio y organizado te pedimos seguir las siguientes pautas.

## Convenciones de código

- Usar TypeScript estricto
- Usar componentes funcionales y hooks de React
- Usar `@/` para imports desde `src/`
- Mantener componentes pequeños y enfocados
- Preferir componentes existentes en `src/components/ui` antes de crear nuevos
- Usar `cn()` desde `@/lib/utils` para clases condicionales
- Mantener archivos no-componentes en `kebab-case` y componentes en `PascalCase`
- No introducir `any` usando tipos explícitos, genéricos o `unknown` cuando sea necesario
- No editar manualmente `src/routeTree.gen.ts` ya que lo genera TanStack Router automáticamente

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
3. Implementa los cambios siguiendo las convenciones del proyecto
4. Verifica que el build pase exitosamente:
   ```bash
   pnpm run build
   ```
5. Revisa los cambios antes de confirmarlos en Git:
   ```bash
   git status
   git diff
   ```
6. Usa commits claros empleando el estilo Conventional Commits:
   ```bash
   git commit -m "feat: agregar filtro de horarios por campus"
   ```
7. Abre un pull request hacia `development` incluyendo el resumen del cambio, el contexto o problema que resuelve, evidencia de verificación, capturas si el cambio afecta la UI y notas de migración si toca base de datos, Worker o variables de entorno

## Buenas prácticas para PRs

- Mantener cambios pequeños y revisables
- Separar cambios de UI, datos, migraciones e infraestructura cuando sea razonable
- Documentar nuevas variables de entorno en `.env.example`
- Incluir migraciones SQL para cambios de esquema
- No confirmar en Git secretos, builds generados, cachés ni datos descargados
- Validar permisos y RLS cuando se agreguen tablas, vistas o RPCs
- Confirmar que los flujos con Turnstile funcionen al modificar reseñas o evaluaciones
