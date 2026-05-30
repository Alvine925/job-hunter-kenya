import { QueryCache, QueryClient } from "@tanstack/react-query";
import { isAuthSessionError, redirectToLoginForExpiredSession } from "@/lib/auth-session";

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

/** Single app-wide cache — survives client-side navigations and is rehydrated from localStorage on refresh. */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isAuthSessionError(error)) {
        redirectToLoginForExpiredSession();
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES,
      gcTime: ONE_DAY,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const QUERY_STALE_DEFAULT = FIVE_MINUTES;
