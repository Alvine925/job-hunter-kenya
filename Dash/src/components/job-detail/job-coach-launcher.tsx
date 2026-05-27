import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jobCoachChat, loadJobCoachChat } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export type CoachMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  similar_jobs?: {
    id: string;
    title: string;
    company: string | null;
    match_score: number | null;
  }[] | null;
};

type Props = {
  jobId: string;
  jobTitle: string;
  userFirstName?: string | null;
};

export function JobCoachLauncher({
  jobId,
  jobTitle,
  userFirstName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [greeting, setGreeting] = useState("");
  const [input, setInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const firstName = userFirstName?.trim() || "there";
  const defaultGreeting = `Hi ${firstName}, you can ask me any question about "${jobTitle}" — your fit, interview prep, or similar jobs to explore.`;

  const { data: loaded, isLoading } = useQuery({
    queryKey: ["job-coach", jobId],
    queryFn: () => loadJobCoachChat(jobId),
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!loaded) return;
    const rows = (loaded.messages ?? []) as CoachMessage[];
    if (rows.length > 0) {
      setMessages(rows);
    } else {
      setMessages([{ role: "assistant", content: loaded.greeting || defaultGreeting }]);
    }
    setGreeting(loaded.greeting || defaultGreeting);
  }, [loaded, jobTitle, firstName]);

  const chatMut = useMutation({
    mutationFn: (text: string) =>
      jobCoachChat({
        jobId,
        userMessage: text,
        messages: messages.filter((m) => m.role === "user" || m.role === "assistant"),
      }),
    onSuccess: (res) => {
      const msg = res.message as CoachMessage;
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          role: "assistant",
          content: msg.content,
          similar_jobs: msg.similar_jobs ?? res.similar_jobs ?? null,
        },
      ]);
      qc.invalidateQueries({ queryKey: ["job-coach", jobId] });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatMut.isPending]);

  const send = () => {
    const text = input.trim();
    if (!text || chatMut.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    chatMut.mutate(text);
  };

  return (
    <>
      {/* FAB + greeting bubble (hover on desktop, tap on touch) */}
      <div className="fixed bottom-6 right-4 sm:right-6 z-40 group flex flex-col items-end gap-2">
        {!open && (
          <>
            {/* Mobile / touch: compact hint, tap FAB toggles */}
            <div
              className={cn(
                "md:hidden relative max-w-[min(100vw-3rem,18rem)] transition-all duration-300 ease-out",
                hintVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none",
              )}
            >
              <button
                type="button"
                className="w-full rounded-2xl border border-primary/20 bg-background shadow-lg px-3 py-2.5 text-left text-xs leading-snug text-foreground cursor-pointer"
                onClick={() => setHintVisible(false)}
              >
                <span className="line-clamp-3">{greeting || defaultGreeting}</span>
              </button>
              <div className="absolute -bottom-1 right-8 w-3 h-3 rotate-45 border-r border-b border-primary/20 bg-background" />
            </div>

            {/* Desktop: full greeting on hover */}
            <div className="hidden md:block max-w-[min(100vw-2rem,20rem)] opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 ease-out">
              <div className="relative rounded-2xl border border-primary/20 bg-background shadow-lg px-4 py-3 text-sm leading-snug text-foreground">
                {greeting || defaultGreeting}
              </div>
              <div className="absolute -bottom-1 right-8 w-3 h-3 rotate-45 border-r border-b border-primary/20 bg-background" />
            </div>
          </>
        )}

        <Button
          type="button"
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => {
            if (!open && !hintVisible && typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
              setHintVisible(true);
              return;
            }
            setHintVisible(false);
            setOpen(true);
          }}
          aria-label="Open job coach"
          aria-expanded={open || hintVisible}
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col gap-0 p-0 bg-[oklch(0.985_0.008_240)] border-l border-border/60"
        >
          <SheetHeader className="shrink-0 px-5 pt-5 pb-4 border-b border-border/50 text-left bg-background/80">
            <SheetTitle className="text-base">Job coach</SheetTitle>
            <SheetDescription className="text-sm">{jobTitle}</SheetDescription>
          </SheetHeader>

          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-[oklch(0.99_0.006_45)]"
          >
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading conversation…
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id ?? i} className="space-y-2">
                <div
                  className={cn(
                    "text-sm leading-relaxed rounded-xl px-3.5 py-2.5 max-w-[92%]",
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-background border border-border/50 text-foreground shadow-sm",
                  )}
                >
                  {m.content}
                </div>
                {m.role === "assistant" && m.similar_jobs && m.similar_jobs.length > 0 && (
                  <ul className="mr-auto max-w-[92%] space-y-1.5 rounded-lg border border-border/50 bg-background p-2.5">
                    <li className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-1">
                      Similar jobs
                    </li>
                    {m.similar_jobs.map((j) => (
                      <li key={j.id}>
                        <Link
                          to="/jobs/$id"
                          params={{ id: j.id }}
                          onClick={() => setOpen(false)}
                          className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors"
                        >
                          <span className="font-medium text-foreground">{j.title}</span>
                          {j.company && (
                            <span className="text-muted-foreground"> · {j.company}</span>
                          )}
                          {j.match_score != null && (
                            <span className="text-xs text-primary ml-1">
                              {Math.round(j.match_score)}% match
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {chatMut.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking…
              </div>
            )}
            {chatMut.isError && (
              <p className="text-xs text-destructive">{(chatMut.error as Error).message}</p>
            )}
          </div>

          <form
            className="shrink-0 flex gap-2 p-4 border-t border-border/50 bg-background"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about fit, gaps, or similar jobs…"
              className="h-10 text-sm"
              disabled={chatMut.isPending || isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={chatMut.isPending || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
