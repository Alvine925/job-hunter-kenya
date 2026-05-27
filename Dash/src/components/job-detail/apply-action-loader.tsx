import { cn } from "@/lib/utils";

type Props = {
  label: string;
  className?: string;
};

/** Overlay with 4-dot send loader while send / save-to-Drive runs. */
export function ApplyActionLoader({ label, className }: Props) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex flex-col items-center justify-center gap-4",
        "bg-background/70 backdrop-blur-[2px]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* CSS-only 4-dot expand/rotate loader — styled in styles.css */}
      <div className="send-loader" aria-hidden="true" />
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
