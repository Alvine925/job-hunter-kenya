import type { InterviewReport } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Target, TrendingUp } from "lucide-react";

export function parseInterviewReport(raw: string | null | undefined): InterviewReport | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InterviewReport;
  } catch {
    return null;
  }
}

type Props = {
  reportRaw: string | null | undefined;
  /** Shown in the interview sidebar (no top divider). */
  embedded?: boolean;
};

export function InterviewReportSection({ reportRaw, embedded = false }: Props) {
  const report = parseInterviewReport(reportRaw);
  if (!report) return null;

  const scoreColor =
    report.overall_score >= 75
      ? "bg-green-600"
      : report.overall_score >= 55
        ? "bg-amber-600"
        : "bg-muted-foreground";

  return (
    <div
      className={
        embedded
          ? "space-y-4 rounded-lg border p-3 sm:p-4 bg-card min-w-0"
          : "space-y-4 pt-6 border-t min-w-0"
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <h3 className="text-sm font-medium">Interview performance report</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={scoreColor}>{report.overall_score}% overall</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(report.generated_at).toLocaleString()}
          </span>
        </div>
      </div>

      <p className="text-sm text-foreground/90 leading-relaxed">{report.summary}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            Strengths
          </div>
          <ul className="text-sm space-y-1.5 list-disc pl-4 text-foreground/80">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <Target className="w-4 h-4" />
            Areas to improve
          </div>
          <ul className="text-sm space-y-1.5 list-disc pl-4 text-foreground/80">
            {report.areas_to_improve.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="w-4 h-4 text-primary" />
          Recommendations
        </div>
        <ul className="text-sm space-y-1.5 list-disc pl-4 text-foreground/80">
          {report.recommendations.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Question-by-question
        </h4>
        {report.question_breakdown.map((q, i) => (
          <div key={i} className="rounded-lg border p-3 text-sm space-y-1.5 min-w-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
              <span className="font-medium leading-snug break-words">{q.question}</span>
              <Badge variant="outline" className="w-fit shrink-0">
                {q.score}/100
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3 sm:line-clamp-2 break-words">
              {q.user_answer}
            </p>
            <p className="text-foreground/80 leading-relaxed break-words">{q.feedback}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
