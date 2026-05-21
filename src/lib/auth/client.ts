import { createAuthClient } from "better-auth/react";
import { jwtClient, magicLinkClient, twoFactorClient } from "better-auth/client/plugins";

import { getApiBaseUrl } from "@/lib/env/public";

const apiBaseUrl = getApiBaseUrl();

export const authClient = createAuthClient({
  baseURL: apiBaseUrl ?? undefined,
  plugins: [
    magicLinkClient(),
    twoFactorClient({
      twoFactorPage: "/auth/2fa",
    }),
    jwtClient(),
  ],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
