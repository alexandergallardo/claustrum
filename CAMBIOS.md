# Cambios realizados (UI/UX navegación y filtros)

Este documento resume **todos los cambios que se aplicaron** durante la sesión y **cómo recrearlos manualmente**.

## 1) Página Curriculum: quitar título y subtítulo

**Archivo:** `src/routes/app/curriculum/-curriculum-page.tsx`

### Qué se cambió
- Se eliminó el bloque visual con:
  - `Plan de estudios`
  - `Visualiza la estructura y requisitos de tu carrera`

### Cómo se aplicó
- Se borró el contenedor `<div className="px-4 lg:px-6">` que contenía el `<h1>` y `<p>`.
- `PlanFilters` quedó como primer bloque visible de la página.

---

## 2) Curriculum: ocultar selector de Universidad cuando solo hay una

### A) Auto-selección por defecto
**Archivo:** `src/routes/app/curriculum/-curriculum-page.tsx`

#### Qué se cambió
- Si el catálogo trae exactamente 1 universidad y no hay `university` en search params, ahora se selecciona automáticamente.

#### Cómo se aplicó
- Se agregó un `useEffect` con esta lógica:
  - condición: `!isLoadingUniversities && universities?.length === 1 && !selectedUniversityId`
  - acción: `navigate({ search: { ...search, university: universities[0].id } })`

### B) Ocultar el filtro de Universidad
**Archivo:** `src/components/plan-estudios/plan-filters.tsx`

#### Qué se cambió
- El select de Universidad se muestra solo si hay más de una opción.
- El select de Sede se habilita igual cuando hay una sola universidad (sin depender de interacción del usuario).

#### Cómo se aplicó
- Se añadieron variables:
  - `shouldShowUniversityFilter = universities.length > 1`
  - `canSelectCampus = shouldShowUniversityFilter ? !!selectedUniversityId : hasUniversities`
- Se cambió:
  - `isVisible` de Universidad: de `true` a `shouldShowUniversityFilter`
  - `isVisible` de Sede: de `!!selectedUniversityId` a `canSelectCampus`

---

## 3) Scroll principal: moverlo del documento al contenido de página

**Archivo:** `src/components/app-layout-wrapper.tsx`

### Qué se cambió
- El scroll principal en rutas `/app/*` ahora ocurre dentro del área de contenido (lado derecho), no a nivel del documento completo.

### Cómo se aplicó
- En `SidebarProvider` se agregó: `className="h-svh overflow-hidden"`
- Se envolvió `{children}` en:
  - `<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">...</div>`

Resultado:
- Header permanece fijo en la zona derecha.
- El contenido debajo del header hace scroll interno.

---

## 4) Página Horarios: quitar título y subtítulo

**Archivo:** `src/routes/app/schedule/-schedule-page.tsx`

### Qué se cambió
- Se eliminó el bloque con:
  - `Horarios`
  - `Visualiza y gestiona tus horarios de clases`

### Cómo se aplicó
- Se borró el `<div>` de encabezado antes de `ScheduleFilters`.
- En estado de carga inicial también se retiró el skeleton que representaba ese encabezado.

---

## 5) Horarios: ocultar selector de Universidad cuando solo hay una

### A) Auto-selección por defecto
**Archivo:** `src/routes/app/schedule/-schedule-page.tsx`

#### Qué se cambió
- Si solo existe una universidad y no está seleccionada, se setea automáticamente en la URL (`search params`).

#### Cómo se aplicó
- Se agregó un `useEffect` con condición equivalente a curriculum:
  - `!isLoadingUniversities && universities?.length === 1 && !selectedUniversityId`
  - navega a `/app/schedule` con `university: universities[0].id`

### B) Ocultar el filtro de Universidad
**Archivo:** `src/components/schedule/schedule-filters.tsx`

#### Qué se cambió
- Universidad solo aparece si hay más de una opción.
- Sede aparece aunque Universidad esté oculta (cuando hay una única universidad).

#### Cómo se aplicó
- Se añadió la misma lógica que en curriculum:
  - `shouldShowUniversityFilter`
  - `canSelectCampus`
- Se actualizó `isVisible` de ambos selectores (Universidad y Sede).

---

## 6) Página Panel (Inicio): quitar título y subtítulo

**Archivo:** `src/routes/app/-dashboard-page.tsx`

### Qué se cambió
- Se eliminó el bloque con:
  - `Tu progreso académico`
  - nombre del plan/carrera (`userStudyPlan?.studyPlanName`)

### Cómo se aplicó
- Se borró el bloque de encabezado dentro del render principal (estado con datos).
- La página inicia directamente con `DashboardStatsCards`.

---

## 7) Sidebar: renombrar “Panel” a “Inicio”

**Archivo:** `src/components/app-sidebar.tsx`

### Qué se cambió
- En la navegación principal se cambió el label:
  - de `Panel`
  - a `Inicio`

### Cómo se aplicó
- En `data.navMain`, primer item (`url: "/app"`) se actualizó `title`.

---

## Verificación ejecutada

Se ejecutó build de producción para validar que los cambios no rompieran compilación:

```bash
bun run build
```

Compiló correctamente después de los cambios.

---

## Lista rápida de archivos modificados por estos cambios

- `src/components/app-layout-wrapper.tsx`
- `src/components/app-sidebar.tsx`
- `src/components/plan-estudios/plan-filters.tsx`
- `src/components/schedule/schedule-filters.tsx`
- `src/routes/app/-dashboard-page.tsx`
- `src/routes/app/curriculum/-curriculum-page.tsx`
- `src/routes/app/schedule/-schedule-page.tsx`
