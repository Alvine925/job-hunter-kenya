import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  minHeightPx?: number;
  serif?: boolean;
  /** Fill parent and scroll inside (apply tab panels). */
  fill?: boolean;
};

export function ApplyComposeField({
  value,
  onChange,
  className,
  minHeightPx = 120,
  serif,
  fill = false,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (fill) return;
    const el = ref.current;
    if (!el) return;

    const resize = () => {
      el.style.height = "0px";
      el.style.height = `${Math.max(el.scrollHeight, minHeightPx)}px`;
    };

    resize();

    // Use ResizeObserver to auto-resize when visibility changes (e.g. active tab toggle)
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, minHeightPx, fill]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={fill ? undefined : 1}
      className={cn(
        "apply-compose-field block w-full p-0 m-0",
        "text-sm sm:text-[15px] leading-relaxed text-foreground",
        serif && "font-[family-name:var(--font-serif,Georgia,serif)]",
        fill
          ? "h-full min-h-0 resize-none overflow-y-auto"
          : "resize-none overflow-hidden",
        className,
      )}
    />
  );
}
