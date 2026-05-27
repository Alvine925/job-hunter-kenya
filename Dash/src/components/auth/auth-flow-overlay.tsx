import { TellusLoader } from "@/components/ui/tellus-loader";
import { cn } from "@/lib/utils";

export function AuthFlowOverlay({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background/95 px-6 backdrop-blur-sm",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <TellusLoader size="lg" />
      <p className="max-w-sm text-center text-sm font-medium text-foreground">{message}</p>
    </div>
  );
}
