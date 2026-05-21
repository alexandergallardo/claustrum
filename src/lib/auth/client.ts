import { jwtClient, magicLinkClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getApiBaseUrl } from "@/lib/env/public";

const apiBaseUrl = getApiBaseUrl() ?? `${window.location.origin}/api`;

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  basePath: "/auth",
  plugins: [
    magicLinkClient(),
    twoFactorClient({
      twoFactorPage: "/auth/2fa",
    }),
    jwtClient(),
  ],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
