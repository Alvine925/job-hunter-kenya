import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { setupQueryCachePersistence } from "@/lib/query-persist";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => setupQueryCachePersistence(queryClient), []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
