import { spawn } from "node:child_process";
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const PORT = 5173;
const URL = `http://127.0.0.1:${PORT}`;

async function waitForServer() {
  console.log("Waiting 8 seconds for dev server to start...");
  await new Promise((r) => setTimeout(r, 8000));
  console.log("Proceeding...");
}

async function main() {
  // Ensure public/og directory exists
  const ogDir = path.resolve(process.cwd(), "public/og");
  await fs.mkdir(ogDir, { recursive: true });

  // Start the dev server
  console.log("Starting Vite dev server...");
  const server = spawn("pnpm", ["exec", "vite", "dev", "--port", PORT.toString(), "--host", "127.0.0.1", "--strictPort"], {
    stdio: "inherit",
    detached: true,
  });

  try {
    await waitForServer();

    console.log("Launching Chromium...");
    const browser = await chromium.launch({ headless: true });
    
    // Create a context with dark color scheme and standard OG size
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      colorScheme: "dark",
      deviceScaleFactor: 1, // Standard OG size (1200x630)
    });

    const page = await context.newPage();

    const routes = [
      { path: "/og/schedule", output: "og-schedule.png" },
      { path: "/og/professors", output: "og-professors.png" },
      { path: "/og/curriculum", output: "og-curriculum.png" },
    ];

    for (const route of routes) {
      console.log(`Navigating to ${route.path}...`);
      await page.goto(`${URL}${route.path}`, { waitUntil: "networkidle" });
      
      // Wait a bit extra for fonts and animations to settle
      await page.waitForTimeout(2000);

      const outputPath = path.join(ogDir, route.output);
      console.log(`Taking screenshot for ${route.output}...`);
      await page.screenshot({ path: outputPath });
      console.log(`Saved ${route.output}`);
    }

    await browser.close();
  } catch (err) {
    console.error("Error generating OG images:", err);
  } finally {
    console.log("Cleaning up server...");
    process.kill(-server.pid!);
  }
}

main().catch(console.error);
