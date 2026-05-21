import { jwtClient, magicLinkClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    twoFactorClient({
      twoFactorPage: "/auth/2fa",
    }),
    jwtClient(),
  ],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
