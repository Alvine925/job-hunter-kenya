import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>

      {/* Two Columns Layout Skeleton */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Main Content (Recent Activity / Applications) */}
        <div className="md:col-span-4 rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar (Recommended Jobs / Match Score) */}
        <div className="md:col-span-3 rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="space-y-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-3 p-4 rounded-lg border border-border bg-muted/40">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded shrink-0" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function JobListSkeleton({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* Header and Filter Skeleton */}
      {!hideHeader && (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-border pb-6">
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>

          {/* Filter and Search Bar Skeleton */}
          <div className="flex flex-col md:flex-row gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-full md:w-44" />
            <Skeleton className="h-10 w-full md:w-44" />
          </div>
        </>
      )}

      {/* Table / List Container Skeleton */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:bg-muted/10 transition-colors">
              <div className="flex gap-4 items-start md:items-center flex-1">
                <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-0 pt-4 md:pt-0">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function JobDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-fade-in max-w-7xl mx-auto px-4 py-8">
      {/* Main Job Detail Skeleton */}
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
          {/* Header section */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex gap-4 items-start">
              <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-64 md:w-96" />
                <div className="flex flex-wrap items-center gap-3">
                  <Skeleton className="h-4 w-32" />
                  <span className="text-muted-foreground/30">•</span>
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>

          <hr className="border-border" />

          {/* Tags row */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/30 border border-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>

          {/* Body/Description skeleton */}
          <div className="space-y-4 pt-4">
            <Skeleton className="h-6 w-36" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[98%]" />
              <Skeleton className="h-4 w-[95%]" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[40%]" />
            </div>
            
            <div className="space-y-2 pt-4">
              <Skeleton className="h-6 w-48" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-muted-foreground">•</span>
                  <Skeleton className="h-4 w-[90%]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Skeleton */}
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <Skeleton className="h-5 w-36" />
          <div className="flex gap-3 items-center">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-sm">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex justify-between items-center text-sm">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <hr className="border-border" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

export function MonitorsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/60 pb-6">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <Skeleton className="h-10 w-full sm:w-28" />
          <Skeleton className="h-10 w-full sm:w-32" />
        </div>
      </div>

      {/* Content list / Site Cards skeleton */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border/60">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-1" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-72 max-w-full" />
                  <div className="flex gap-4 pt-1">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TemplatesSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/60 pb-6">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full sm:w-36 shrink-0" />
      </div>

      {/* Templates editor items skeleton */}
      <div className="divide-y divide-border/60">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="py-6 first:pt-0 space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-80 max-w-full" />
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[98%]" />
              <Skeleton className="h-4 w-[95%]" />
              <Skeleton className="h-4 w-[60%]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/60 pb-6">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <Skeleton className="h-10 w-full sm:w-28" />
          <Skeleton className="h-10 w-full sm:w-28" />
        </div>
      </div>

      {/* Identity Card Skeleton */}
      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4 sm:gap-5 border-b border-border/60 pb-6">
        <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 rounded-full shrink-0" />
        <div className="space-y-2.5 flex-1 min-w-0 w-full text-center sm:text-left">
          <Skeleton className="h-6 w-48 mx-auto sm:mx-0" />
          <Skeleton className="h-4 w-60 mx-auto sm:mx-0" />
          <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-1">
            <Skeleton className="h-5.5 w-20 rounded-full" />
            <Skeleton className="h-5.5 w-24 rounded-full" />
          </div>
        </div>
      </div>

      {/* Contact Grid Skeleton */}
      <div className="pb-6 border-b border-border/60 space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>

      {/* Professional Summary Skeleton */}
      <div className="pb-6 border-b border-border/60 space-y-3">
        <Skeleton className="h-5 w-44" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[98%]" />
          <Skeleton className="h-4 w-[85%]" />
        </div>
      </div>

      {/* Skills Badges Skeleton */}
      <div className="pb-6 border-b border-border/60 space-y-3">
        <Skeleton className="h-5 w-16" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-18" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-14" />
        </div>
      </div>

      {/* Timelines Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-4 border-l border-border/50 pl-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5 relative">
                <div className="absolute -left-[25px] top-1.5 w-2 h-2 rounded-full bg-border shrink-0" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-5 w-28" />
          <div className="space-y-4 border-l border-border/50 pl-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5 relative">
                <div className="absolute -left-[25px] top-1.5 w-2 h-2 rounded-full bg-border shrink-0" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConfigSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/60 pb-6">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full sm:w-36 shrink-0" />
      </div>

      {/* Preset Selector Skeleton */}
      <div className="pb-6 border-b border-border/60 space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Config Sections Skeleton */}
      <div className="divide-y divide-border/60 space-y-6">
        <div className="pt-6 space-y-4">
          <Skeleton className="h-5 w-44" />
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
        </div>

        <div className="pt-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <div className="space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5.5 w-16 rounded-full" />
                <Skeleton className="h-5.5 w-20 rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5.5 w-24 rounded-full" />
                <Skeleton className="h-5.5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedbackSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
      {/* Header Skeleton */}
      <div className="border-b border-border/60 pb-6 space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Form Input Skeleton */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4.5 w-36" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-full" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4.5 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4.5 w-28" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-10 w-full sm:w-28" />
      </div>
    </div>
  );
}
