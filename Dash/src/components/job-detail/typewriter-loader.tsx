import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  sublabel?: string;
  className?: string;
};

export function TypewriterLoader({
  label = "Composing application...",
  sublabel = "Generating a high-quality cover letter and email draft tailored precisely to this role. This usually takes about 15–30 seconds.",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center min-h-[300px] animate-in fade-in duration-500",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="typewriter mb-6">
        <div className="slide"><i></i></div>
        <div className="paper"></div>
        <div className="keyboard"></div>
      </div>

      <div className="max-w-sm space-y-2">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {label}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {sublabel}
        </p>
      </div>
    </div>
  );
}
