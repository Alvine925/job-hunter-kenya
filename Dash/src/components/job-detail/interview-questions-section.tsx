import { Button } from "@/components/ui/button";
import { TellusLoader } from "@/components/ui/tellus-loader";
import { ClipboardList, Copy } from "lucide-react";
import { toast } from "sonner";

export function sanitizeMarkdownToPlainText(text: string): string {
  if (!text) return "";
  let s = text;
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/^[\*\-\+]\s+/gm, "");
  return s.trim();
}

export type InterviewQa = { question: string; answer: string };

export function parseInterviewQuestions(raw: string | null | undefined): InterviewQa[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as InterviewQa[];
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        question: sanitizeMarkdownToPlainText(item.question ?? ""),
        answer: sanitizeMarkdownToPlainText(item.answer ?? ""),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

type Props = {
  interviewQuestionsRaw: string | null | undefined;
  onGenerate: () => void;
  generatePending: boolean;
  hideButton?: boolean;
};

export function InterviewQuestionsSection({
  interviewQuestionsRaw,
  onGenerate,
  generatePending,
  hideButton = false,
}: Props) {
  const items = parseInterviewQuestions(interviewQuestionsRaw);
  const hasItems = items.length > 0;
  const showList = hasItems && !generatePending;

  return (
    <div className="space-y-4 sm:space-y-5 min-w-0">
      {generatePending ? (
        <div className="py-8 sm:py-10 flex flex-col items-center justify-center gap-4 text-center px-2">
          <TellusLoader size="md" />
          <div className="max-w-sm">
            <p className="text-sm font-medium text-foreground">Drafting interview prep</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Building role-specific questions and sample answers from your profile. This usually
              takes 15–30 seconds.
            </p>
          </div>
        </div>
      ) : (
        <>
          {!hideButton && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
              <Button
                onClick={onGenerate}
                disabled={generatePending}
                className="w-full sm:w-auto h-11 sm:h-10"
              >
                <ClipboardList className="w-4 h-4 mr-2 shrink-0" />
                {hasItems ? "Regenerate interview prep" : "Draft interview prep"}
              </Button>
              {showList && (
                <span className="text-xs text-muted-foreground sm:text-left text-center">
                  {items.length} questions
                </span>
              )}
            </div>
          )}

          {hideButton && showList && (
            <div className="text-xs text-muted-foreground mb-3">
              {items.length} questions
            </div>
          )}

          {showList && (
            <div className="divide-y divide-border/50 rounded-lg border border-border/50 bg-card/30 sm:bg-transparent sm:border-0 sm:rounded-none">
              {items.map((qa, i) => (
                <article key={i} className="px-3 py-4 sm:px-0 sm:py-5 text-sm first:pt-4 sm:first:pt-0">
                  <p className="font-semibold text-sm sm:text-[15px] leading-snug text-primary break-words">
                    <span className="text-muted-foreground font-medium mr-1.5">{i + 1}.</span>
                    {qa.question}
                  </p>
                  <p className="mt-2.5 sm:mt-3 text-sm sm:text-[15px] leading-relaxed text-foreground/85 whitespace-pre-wrap break-words">
                    {qa.answer}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(qa.answer);
                      toast.success("Copied answer");
                    }}
                    className="text-xs text-primary/90 hover:text-primary mt-2.5 min-h-9 inline-flex gap-1.5 items-center touch-manipulation"
                  >
                    <Copy className="w-3.5 h-3.5 shrink-0" /> Copy answer
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
