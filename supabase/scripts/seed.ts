import { spawnSync } from "node:child_process";

type Args = {
  apiArgs: string[];
};

function parseArgs(argv: string[]): Args {
  const sepIndex = argv.indexOf("--");
  return {
    apiArgs: sepIndex >= 0 ? argv.slice(sepIndex + 1) : argv.slice(2),
  };
}

function env(name: string): string {
  const v = process.env[name];
  if (v == null || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function assertRequiredEnv(): void {
  const supabaseUrl = env("VITE_SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY");

  if (!/^https?:\/\//.test(supabaseUrl)) {
    throw new Error(
      `VITE_SUPABASE_URL must start with http(s):// (got: ${supabaseUrl})`,
    );
  }

  if (!secretKey.startsWith("sb_secret_")) {
    console.warn(
      "WARNING: SUPABASE_SECRET_KEY does not start with sb_secret_.",
    );
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv);

  assertRequiredEnv();

  console.log("");
  console.log("==> Running HTTP-only seed (seed-itcr.ts) ...");
  console.log("");

  const child = spawnSync(
    "bun",
    ["run", "supabase/scripts/seed-itcr.ts", ...args.apiArgs],
    {
      env: process.env,
      stdio: "inherit",
    },
  );

  if (child.status !== 0) {
    throw new Error(`ITCR seeder failed with exit code ${child.status ?? 1}`);
  }

  console.log("");
  console.log("✓ HTTP-only seed completed successfully.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
