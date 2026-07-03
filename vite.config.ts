import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [mdx(), TanStackRouterVite({ autoCodeSplitting: true }), tailwindcss(), react()],
  optimizeDeps: {
    exclude: ["html-to-image"],
  },
  server: {
    watch: {
      ignored: ["**/.codebase-memory/**", "**/.opencode/**"],
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { test: /node_modules\/@supabase\/supabase-js/, name: "vendor-supabase" },
            { test: /node_modules\/@tanstack\//, name: "vendor-tanstack" },
            { test: /node_modules\/recharts/, name: "vendor-recharts" },
            { test: /node_modules\/framer-motion/, name: "vendor-framer-motion" },
            { test: /node_modules\/@dnd-kit/, name: "vendor-dnd-kit" },
            { test: /node_modules\/html-to-image/, name: "vendor-html-to-image" },
          ],
        },
      },
    },
  },
});
