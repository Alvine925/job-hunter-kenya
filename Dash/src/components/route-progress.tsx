import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function RouteProgress() {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" });
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer: number;
    let progressTimer: number;

    if (isLoading) {
      setVisible(true);
      setProgress(0);
      
      // Simulate real-world step-wise progression (0 -> 30% -> 60% -> 85% -> 95%)
      progressTimer = window.setInterval(() => {
        setProgress((prev) => {
          if (prev < 30) return prev + Math.random() * 10 + 5;
          if (prev < 60) return prev + Math.random() * 5 + 2;
          if (prev < 85) return prev + Math.random() * 2 + 0.5;
          if (prev < 95) return prev + 0.1;
          return prev;
        });
      }, 150);
    } else {
      // Complete the progress and fade out
      setProgress(100);
      timer = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }

    return () => {
      clearInterval(progressTimer);
      clearTimeout(timer);
    };
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[99999] pointer-events-none bg-transparent">
      <div
        className="h-full bg-[#FD5D28] shadow-[0_0_8px_rgba(253,93,40,0.6)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 
            ? "width 200ms ease-out, opacity 350ms ease-in" 
            : "width 150ms ease-out",
        }}
      />
    </div>
  );
}
