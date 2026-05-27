import { lazy, Suspense } from "react";

const MarketplacePageContent = lazy(() =>
  import("./marketplace-page-content").then((module) => ({
    default: module.MarketplacePageContent,
  })),
);

export function MarketplacePage() {
  return (
    <Suspense fallback={<MarketplacePageShell />}>
      <MarketplacePageContent />
    </Suspense>
  );
}

function MarketplacePageShell() {
  return (
    <div className="min-h-full flex flex-col bg-muted/30 lg:max-h-full lg:overflow-hidden">
      <header className="border-b border-border/60 bg-background sticky top-0 z-20 shrink-0">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 hidden md:block">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Marketplace
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Loading listings
              </p>
            </div>
            <div className="h-9 w-full sm:w-36 rounded-full bg-muted animate-pulse" />
          </div>
          <div className="max-w-md space-y-2">
            <div className="h-3 w-14 rounded bg-muted animate-pulse" />
            <div className="h-10 sm:h-9 rounded-md border border-border/80 bg-background" />
          </div>
          <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-9 rounded-md border border-border/80 bg-background"
              />
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:overflow-hidden lg:flex lg:flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
          <div className="lg:col-span-2 space-y-3">
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            <div className="sm:border sm:border-border/80 sm:rounded-xl sm:bg-background sm:overflow-hidden sm:divide-y sm:divide-border/60">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="sm:flex sm:gap-4 sm:px-5 sm:py-4 p-4">
                  <div className="h-12 w-12 rounded-lg bg-muted animate-pulse shrink-0" />
                  <div className="mt-3 sm:mt-0 flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-full rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <aside className="hidden lg:block space-y-3">
            <div className="h-44 rounded-xl border border-border/80 bg-background p-4">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="mt-6 h-2 rounded-full bg-muted animate-pulse" />
              <div className="mt-6 space-y-2">
                <div className="h-3 rounded bg-muted animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
