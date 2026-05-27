import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
} from "@tanstack/react-query";

const STORAGE_KEY = "tellus-query-cache-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const PERSIST_ROOT_KEYS = new Set([
  "jobs",
  "saved-jobs",
  "job",
  "scraped_jobs",
  "interview-quiz",
]);

function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  const root = query.queryKey[0];
  return typeof root === "string" && PERSIST_ROOT_KEYS.has(root);
}

export function hydrateQueryCache(client: QueryClient): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
    if (!parsed.savedAt || !parsed.state) return;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    hydrate(client, parsed.state as DehydratedState);
  } catch (e) {
    console.warn("[query-persist] hydrate failed", e);
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function persistQueryCache(client: QueryClient): void {
  if (typeof window === "undefined") return;
  try {
    const state = dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), state }),
    );
  } catch (e) {
    console.warn("[query-persist] persist failed", e);
  }
}

export function clearPersistedQueryCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function setupQueryCachePersistence(client: QueryClient): () => void {
  if (typeof window === "undefined") return () => undefined;

  hydrateQueryCache(client);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedulePersist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => persistQueryCache(client), 800);
  };

  const unsub = client.getQueryCache().subscribe(schedulePersist);
  schedulePersist();

  return () => {
    if (timer) clearTimeout(timer);
    unsub();
    persistQueryCache(client);
  };
}
