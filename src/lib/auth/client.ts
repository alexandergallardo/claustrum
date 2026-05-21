import { jwtClient, magicLinkClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getApiBaseUrl } from "@/lib/env/public";

const apiBaseUrl = getApiBaseUrl() ?? `${window.location.origin}/api`;
const authBaseUrl = `${apiBaseUrl}/auth`;

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [
    magicLinkClient(),
    twoFactorClient({
      twoFactorPage: "/auth/2fa",
    }),
    jwtClient(),
  ],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
