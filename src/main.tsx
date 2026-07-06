import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";

import { ThemeProvider } from "@/components/theme-provider";
import { queryClient } from "@/lib/query-client";

import { getRouter } from "./router";
import "./styles.css";

const CHUNK_RELOAD_KEY = "vite-chunk-reload-time";

window.addEventListener("vite:preloadError", () => {
  const lastReloadStr = sessionStorage.getItem(CHUNK_RELOAD_KEY);
  const lastReload = lastReloadStr ? parseInt(lastReloadStr, 10) : 0;
  const now = Date.now();

  if (now - lastReload < 10000) {
    console.error("Vite chunk reload loop detected. Stopping.");
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, now.toString());
  window.location.reload();
});

const router = getRouter();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
