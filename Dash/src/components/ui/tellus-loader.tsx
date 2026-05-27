import { cn } from "@/lib/utils";

/** Branded orbital loader — colours from Tellus theme (primary orange + accent). */
export function TellusLoader({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm" ? "w-10" : size === "lg" ? "w-[5.5rem]" : "w-[4.375rem]";
  return <div className={cn("tellus-loader", dim, className)} aria-hidden />;
}

export function ScrapingLoaderPanel({
  title = "Finding jobs for you",
  description = "Scanning job boards and scoring listings against your profile. This usually takes 10–15 seconds.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-24 gap-5 text-center max-w-md mx-auto",
        className,
      )}
    >
      <div className="job-detail-loader" />
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
