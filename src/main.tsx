import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";

import { ThemeProvider } from "@/components/theme-provider";
import { queryClient } from "@/lib/query-client";

import { getRouter } from "./router";
import "./styles.css";

const CHUNK_RELOAD_KEY = "vite-chunk-reload";

window.addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") {
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
});

window.addEventListener("pageshow", () => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
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
