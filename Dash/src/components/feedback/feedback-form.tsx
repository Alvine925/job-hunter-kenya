import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bug, Lightbulb, Loader2, MessageSquare, Sparkles, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FeedbackCategory = "feedback" | "suggestion" | "feature" | "bug";

const CATEGORIES: {
  type: FeedbackCategory;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    type: "feedback",
    label: "Feedback",
    icon: MessageSquare,
    description: "General comments",
  },
  {
    type: "suggestion",
    label: "Suggestion",
    icon: Lightbulb,
    description: "Workflow ideas",
  },
  {
    type: "feature",
    label: "Feature",
    icon: Sparkles,
    description: "New capabilities",
  },
  {
    type: "bug",
    label: "Bug",
    icon: Bug,
    description: "Technical issues",
  },
];

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

type Props = {
  userId?: string | null;
  onSubmitted?: () => void;
};

export function FeedbackForm({ userId, onSubmitted }: Props) {
  const [category, setCategory] = useState<FeedbackCategory>("feedback");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [showValidationError, setShowValidationError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setCategory("feedback");
    setRating(0);
    setMessage("");
    setShowValidationError(false);
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setShowValidationError(true);
      return;
    }
    if (!userId) {
      toast.error("You must be signed in to submit feedback");
      return;
    }

    setShowValidationError(false);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("user_feedback").insert({
        user_id: userId,
        category,
        rating: rating || null,
        message: message.trim(),
      });
      if (error) throw error;

      const ratingText = rating ? `${rating}/5 (${RATING_LABELS[rating]})` : "No rating";
      const { error: emailError } = await supabase.functions.invoke("help-contact", {
        body: {
          subject: `Feedback: ${CATEGORIES.find((cat) => cat.type === category)?.label ?? category}`,
          message: [`Category: ${category}`, `Rating: ${ratingText}`, "", message.trim()].join(
            "\n",
          ),
        },
      });

      if (emailError) {
        console.warn("Feedback email notification failed:", emailError);
      } else {
        toast.success("Feedback email sent", {
          description: "Your feedback was emailed to hello@tellusjobs.site.",
        });
      }

      toast.success("Feedback submitted", {
        description: "Thank you — your input helps us improve Tellus.",
      });
      reset();
      onSubmitted?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error("Failed to submit feedback", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="space-y-6 sm:space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <section className="space-y-3">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Category
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const selected = category === cat.type;
            return (
              <button
                key={cat.type}
                type="button"
                onClick={() => setCategory(cat.type)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border text-left transition-colors min-h-[72px]",
                  selected
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border/80 hover:bg-muted/30",
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 mb-1 shrink-0",
                    selected ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="text-xs sm:text-sm font-medium leading-tight">{cat.label}</span>
                <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                  {cat.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 pb-6 border-b border-border/60">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Experience rating <span className="normal-case font-normal">(optional)</span>
          </Label>
          {rating > 0 && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {RATING_LABELS[rating]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Rate ${star} out of 5`}
            >
              <Star
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 transition-colors",
                  star <= rating
                    ? "fill-amber-500 text-amber-500"
                    : "text-muted-foreground/35 hover:text-muted-foreground/70",
                )}
              />
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="feedback-message"
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Message
          </Label>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {message.length}/500
          </span>
        </div>
        <Textarea
          id="feedback-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value.slice(0, 500));
            if (e.target.value.trim()) setShowValidationError(false);
          }}
          placeholder={
            category === "bug"
              ? "Describe the issue and steps to reproduce…"
              : category === "feature"
                ? "What would you like Tellus to do?"
                : "Share your thoughts…"
          }
          rows={6}
          className="resize-y min-h-[140px] text-sm border-border/80"
        />
        {showValidationError && (
          <p className="text-xs text-destructive font-medium">
            Please enter a message before submitting.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3 pt-2 border-t border-border/60">
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          disabled={isSubmitting}
          className="h-10 sm:h-9 border-border/60"
        >
          Clear
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-10 sm:h-9 font-semibold shadow-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending…
            </>
          ) : (
            "Submit feedback"
          )}
        </Button>
      </div>
    </form>
  );
}
