# AGENTS.md - Guidelines for AI Coding Agents

This document provides guidelines for AI agents operating in this repository.

## Commands

### Package Manager

- **Always use Bun** for all package management operations
- Never use npm, npx, pnpm, or yarn
- Use `bun install` to install dependencies
- Use `bun add <package>` to add new dependencies
- Use `bun remove <package>` to remove dependencies

### Development

- **Do NOT start the dev server** unless explicitly requested by the user

### Building

- Build for production: `bun run build`
- Preview production build: `bun run preview`
- Deploy to Cloudflare: `bun run deploy`

### Testing

- **No tests exist in this project**
- Do NOT run `bun run test` or any test commands
- If asked to run tests, inform the user that this project has no tests configured

### Supabase (when needed)

- Start local Supabase: `bun run supabase:start`
- Stop Supabase: `bun run supabase:stop`
- Reset database: `bun run supabase:reset`
- Run migrations: `bun run supabase:migrate`
- Seed database: `bun run supabase:seed`
- Full setup: `bun run supabase:setup`

## Code Style Guidelines

### Imports

- **Always use the `@/` alias** for imports from `src/`
  - Correct: `import { Button } from "@/components/ui/button"`
  - Incorrect: `import { Button } from "../../components/ui/button"`
- The `@/` alias is configured in `tsconfig.json` and maps to `./src/*`
- Group imports: React/external imports first, then local imports

### TypeScript

- Strict mode is enabled in `tsconfig.json`
- No `any` types - use explicit types or `unknown` where appropriate
- Enable `noUncheckedSideEffectImports: true` in new code
- Use proper type inference, avoid redundant type annotations

### Naming Conventions

- **Components**: PascalCase (e.g., `LoginForm`, `AppSidebar`)
- **Files**: kebab-case for non-component files (e.g., `utils.ts`, `api.ts`)
- **Routes**: Use directory-based structure in `src/routes/`
- **Variables/functions**: camelCase (e.g., `isLoading`, `handleSubmit`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Booleans**: Prefix with `is`, `has`, `can` (e.g., `isValid`, `hasAccess`)

### File Structure (TanStack Router)

Routes use **file-based routing** in `src/routes/`:

```
src/routes/
├── __root.tsx           # Root layout
├── _index.tsx           # Landing page (/)
├── login/
│   └── index.tsx        # /login route
├── signup/
│   └── index.tsx        # /signup route
└── app/
    ├── _layout.tsx      # App layout (Header + Sidebar)
    └── _index.tsx       # Dashboard (/app)
```

- `_layout.tsx` = Pathless layout wrapper (uses Outlet, doesn't add to URL)
- `index.tsx` = Route at that directory's path
- `_index.tsx` = Index route for parent directory
- Routes are automatically generated from file structure

### Error Handling

- Use try/catch with async/await for API calls
- Provide user-friendly error messages
- Log errors appropriately for debugging
- Handle edge cases explicitly (no silent failures)

### React Components

- Use functional components with hooks
- Use TypeScript interfaces for props
- Keep components small and focused
- Extract reusable logic to custom hooks
- Use proper React.FC typing or explicit prop types

### CSS/Tailwind

- Tailwind CSS v4 is configured
- Use utility classes for styling
- Follow existing design patterns from shadcn/ui components
- Use `cn()` from `@/lib/utils` for conditional classes

### shadcn/ui Components

- Components are in `@/components/ui/`
- Use existing components before creating new ones
- Follow shadcn conventions for component structure

## General Guidelines

- Keep responses concise and focused on the task
- Before modifying files, read them to understand the context
- Follow existing code patterns and conventions
- Do not add comments unless explicitly requested
- Ask for clarification when requirements are unclear
- Report errors clearly with relevant context

## Agent Editing Workflow

- **Do not use shell commands to edit files** (e.g., heredoc writes, `sed -i`, `perl -pi`, `cat > file`).
- Always use the agent's file editing tools for code/document changes.
- Use shell commands only for execution tasks (builds, git, migrations, checks), not for file content editing.
