import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const checkServerSession = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const cookieHeader = request?.headers?.get("cookie") || "";
  const hasSession = cookieHeader.includes("tellus-session-active=true");
  return { hasSession };
});
