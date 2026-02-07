import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    react(),
  ],
  optimizeDeps: {
    exclude: ['html-to-image'],
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase/supabase-js')) return 'vendor-supabase'
          if (id.includes('node_modules/@tanstack/')) return 'vendor-tanstack'
          if (id.includes('node_modules/recharts')) return 'vendor-recharts'
          if (id.includes('node_modules/framer-motion')) return 'vendor-framer-motion'
          if (id.includes('node_modules/@dnd-kit')) return 'vendor-dnd-kit'
          if (id.includes('node_modules/html-to-image')) return 'vendor-html-to-image'
          return undefined
        },
      },
    },
  },
})
