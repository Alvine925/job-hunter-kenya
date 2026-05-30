import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { Badge } from "@/components/ui/badge";
import { FeedbackSkeleton } from "@/components/ui/skeleton-loaders";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({
    title: "Feedback - Tellus",
    meta: [
      { title: "Feedback - Tellus" },
      { name: "description", content: "Help us improve Tellus by submitting feedback, feature suggestions, or ratings." },
    ],
  }),
  component: FeedbackPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  feedback: "Feedback",
  suggestion: "Suggestion",
  feature: "Feature",
  bug: "Bug",
};

function FeedbackPage() {
  const { data: authUser, isLoading: authLoading } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: pastFeedback = [], refetch } = useQuery({
    queryKey: ["user_feedback", authUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_feedback")
        .select("id, category, rating, message, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!authUser?.id,
  });

  if (authLoading) {
    return <FeedbackSkeleton />;
  }

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 sticky top-0 z-10 bg-background">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Feedback</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
            Report bugs, request features, or share ideas. We read every submission.
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-xl">
            For urgent support, email{" "}
            <a href="mailto:hello@tellusjobs.site" className="font-semibold text-[#FD5D28] hover:underline">
              hello@tellusjobs.site
            </a>
            .
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-8 sm:space-y-10 animate-in fade-in duration-300">
        <FeedbackForm userId={authUser?.id} onSubmitted={() => refetch()} />

        {pastFeedback.length > 0 && (
          <section className="pt-6 border-t border-border/60 space-y-4" aria-label="Your recent feedback">
            <h2 className="text-sm font-semibold text-foreground">Your recent submissions</h2>
            <ul className="divide-y divide-border/60">
              {pastFeedback.map((item) => (
                <li key={item.id} className="py-4 first:pt-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Badge>
                    {item.rating != null && (
                      <span className="text-xs text-muted-foreground">
                        {item.rating}/5 stars
                      </span>
                    )}
                    <time className="text-xs text-muted-foreground ml-auto">
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {item.message}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
