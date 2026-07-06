import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { getSession } from "@/lib/auth/client";

export const getAuthSessionServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();

  const fetchHeaders: Record<string, string> = {};
  const cookie = typeof headers.get === "function" ? (headers as Headers).get("cookie") : (headers as any).cookie;
  const authorization = typeof headers.get === "function" ? (headers as Headers).get("authorization") : (headers as any).authorization;
  
  if (cookie) fetchHeaders.cookie = cookie;
  if (authorization) fetchHeaders.authorization = authorization;

  const { data } = await getSession({
    fetchOptions: {
      headers: fetchHeaders,
    },
  });

  return data;
});
