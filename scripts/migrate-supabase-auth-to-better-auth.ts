import { randomUUID } from "node:crypto";

import { Pool } from "pg";

type SupabaseIdentity = {
  id: string;
  provider_id: string | null;
  user_id: string;
  identity_data: Record<string, unknown> | null;
  provider: string;
  created_at: string | null;
  updated_at: string | null;
};

type SupabaseUser = {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
  invited_at: string | null;
  last_sign_in_at: string | null;
  raw_app_meta_data: Record<string, unknown> | null;
  raw_user_meta_data: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  identities: SupabaseIdentity[];
};

type BetterAuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  userMetadata: Record<string, unknown> | null;
  appMetadata: Record<string, unknown> | null;
  invitedAt: string | null;
  lastSignInAt: string | null;
};

const batchSize = Number(process.env.MIGRATION_BATCH_SIZE ?? 1000);
const fromDatabaseUrl = process.env.FROM_DATABASE_URL ?? process.env.DATABASE_URL;
const toDatabaseUrl = process.env.TO_DATABASE_URL ?? process.env.DATABASE_URL;

if (!fromDatabaseUrl || !toDatabaseUrl) {
  throw new Error("FROM_DATABASE_URL/TO_DATABASE_URL or DATABASE_URL is required");
}

const fromDb = new Pool({ connectionString: fromDatabaseUrl });
const toDb = new Pool({ connectionString: toDatabaseUrl });

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function getName(user: SupabaseUser): string {
  const metadata = user.raw_user_meta_data ?? {};
  const firstIdentity = user.identities[0]?.identity_data ?? {};
  return (
    getString(metadata.full_name) ??
    getString(metadata.name) ??
    getString(metadata.user_name) ??
    getString(firstIdentity.full_name) ??
    getString(firstIdentity.name) ??
    getString(firstIdentity.preferred_username) ??
    user.email?.split("@")[0] ??
    "Usuario"
  );
}

function getImage(user: SupabaseUser): string | null {
  const metadata = user.raw_user_meta_data ?? {};
  const firstIdentity = user.identities[0]?.identity_data ?? {};
  return (
    getString(metadata.avatar_url) ??
    getString(metadata.picture) ??
    getString(firstIdentity.avatar_url) ??
    getString(firstIdentity.picture)
  );
}

function toBetterAuthUser(user: SupabaseUser): BetterAuthUser | null {
  if (!user.email || user.deleted_at) return null;
  const now = new Date().toISOString();
  return {
    id: user.id,
    email: user.email,
    name: getName(user),
    image: getImage(user),
    emailVerified: user.email_confirmed_at !== null,
    createdAt: user.created_at ?? now,
    updatedAt: user.updated_at ?? user.created_at ?? now,
    userMetadata: user.raw_user_meta_data,
    appMetadata: user.raw_app_meta_data,
    invitedAt: user.invited_at,
    lastSignInAt: user.last_sign_in_at,
  };
}

async function insertUser(client: Pool, user: BetterAuthUser): Promise<void> {
  await client.query(
    `
      INSERT INTO better_auth."user" (
        "id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt",
        "userMetadata", "appMetadata", "invitedAt", "lastSignInAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "email" = EXCLUDED."email",
        "emailVerified" = EXCLUDED."emailVerified",
        "image" = EXCLUDED."image",
        "updatedAt" = EXCLUDED."updatedAt",
        "userMetadata" = EXCLUDED."userMetadata",
        "appMetadata" = EXCLUDED."appMetadata",
        "invitedAt" = EXCLUDED."invitedAt",
        "lastSignInAt" = EXCLUDED."lastSignInAt"
    `,
    [
      user.id,
      user.name,
      user.email,
      user.emailVerified,
      user.image,
      user.createdAt,
      user.updatedAt,
      user.userMetadata,
      user.appMetadata,
      user.invitedAt,
      user.lastSignInAt,
    ],
  );

  await client.query('INSERT INTO public."user" (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [
    user.id,
  ]);
}

async function insertAccount(
  client: Pool,
  account: {
    userId: string;
    providerId: string;
    accountId: string;
    password: string | null;
    createdAt: string;
    updatedAt: string;
  },
): Promise<void> {
  const exists = await client.query<{ id: string }>(
    `
      SELECT "id"
      FROM better_auth."account"
      WHERE "userId" = $1 AND "providerId" = $2 AND "accountId" = $3
      LIMIT 1
    `,
    [account.userId, account.providerId, account.accountId],
  );
  if (exists.rowCount && exists.rowCount > 0) return;

  await client.query(
    `
      INSERT INTO better_auth."account" (
        "id", "userId", "providerId", "accountId", "password", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      randomUUID(),
      account.userId,
      account.providerId,
      account.accountId,
      account.password,
      account.createdAt,
      account.updatedAt,
    ],
  );
}

async function migrateBatch(users: SupabaseUser[]): Promise<{ migrated: number; skipped: number }> {
  let migrated = 0;
  let skipped = 0;
  await toDb.query("BEGIN");
  try {
    for (const supabaseUser of users) {
      const betterUser = toBetterAuthUser(supabaseUser);
      if (!betterUser) {
        skipped++;
        continue;
      }

      await insertUser(toDb, betterUser);

      if (supabaseUser.encrypted_password) {
        await insertAccount(toDb, {
          userId: supabaseUser.id,
          providerId: "credential",
          accountId: supabaseUser.id,
          password: supabaseUser.encrypted_password,
          createdAt: betterUser.createdAt,
          updatedAt: betterUser.updatedAt,
        });
      }

      for (const identity of supabaseUser.identities) {
        if (identity.provider === "email") continue;
        const accountId =
          getString(identity.identity_data?.sub) ?? identity.provider_id ?? identity.id;
        await insertAccount(toDb, {
          userId: supabaseUser.id,
          providerId: identity.provider,
          accountId,
          password: null,
          createdAt: identity.created_at ?? betterUser.createdAt,
          updatedAt: identity.updated_at ?? betterUser.updatedAt,
        });
      }

      migrated++;
    }
    await toDb.query("COMMIT");
    return { migrated, skipped };
  } catch (error) {
    await toDb.query("ROLLBACK");
    throw error;
  }
}

async function main(): Promise<void> {
  let lastId = process.env.MIGRATION_RESUME_FROM_ID ?? null;
  let totalMigrated = 0;
  let totalSkipped = 0;

  for (;;) {
    const result = await fromDb.query<SupabaseUser>(
      `
        SELECT
          u.*,
          COALESCE(json_agg(i.* ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]'::json) AS identities
        FROM auth.users u
        LEFT JOIN auth.identities i ON i.user_id = u.id
        ${lastId ? "WHERE u.id > $1" : ""}
        GROUP BY u.id
        ORDER BY u.id ASC
        LIMIT $${lastId ? "2" : "1"}
      `,
      lastId ? [lastId, batchSize] : [batchSize],
    );

    if (result.rows.length === 0) break;

    const stats = await migrateBatch(result.rows);
    totalMigrated += stats.migrated;
    totalSkipped += stats.skipped;
    lastId = result.rows[result.rows.length - 1]?.id ?? lastId;
    process.stdout.write(
      `Migrated batch: ${stats.migrated}, skipped: ${stats.skipped}, last id: ${lastId}`,
    );
    process.stdout.write("\n");

    if (result.rows.length < batchSize) break;
  }

  process.stdout.write(
    `Migration complete. Migrated: ${totalMigrated}, skipped: ${totalSkipped}\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await fromDb.end();
    await toDb.end();
  });
