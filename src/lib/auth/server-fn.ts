import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { getSession } from "@/lib/auth/client";

export const getAuthSessionServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();

  const { data } = await getSession({
    fetchOptions: {
      headers: headers as any,
    },
  });

  return data;
});
