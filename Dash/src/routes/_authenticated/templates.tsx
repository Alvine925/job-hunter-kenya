import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getMyProfile, listAgentTemplates, saveAgentTemplate, type AgentTemplateType } from "@/lib/api";
import {
  buildDefaultAgentTemplateContent,
  pickTemplateUserDetails,
  resolveTemplateContent,
} from "@/lib/agent-template-defaults";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, PenSquare, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    title: "AI Cover Letter Templates - Tellus",
    meta: [
      { title: "AI Cover Letter Templates - Tellus" },
      { name: "description", content: "Customize the AI instructions and prompts used to write your personalized cover letters and answers." },
    ],
  }),
  component: Templates,
});

const TEMPLATE_META: {
  type: AgentTemplateType;
  name: string;
  helper: string;
  editHint?: string;
}[] = [
  {
    type: "job_matching",
    name: "Job matching",
    helper: "Rubric for scoring listings, extracting qualifications, and classifying email vs form applications.",
  },
  {
    type: "cover_letter",
    name: "Cover letter",
    helper: "Structure and voice the cover letter agent follows when drafting letters.",
  },
  {
    type: "email_body",
    name: "Email body",
    helper:
      "Default email sent with your CV. Edit the sample below — the agent uses it for tone, structure, and required details (salary, notice period).",
    editHint: "Prefilled sample you can customize. My Jobs in Kenya requires the job title as subject plus salary and notice in the body.",
  },
  {
    type: "form_response",
    name: "Form responses",
    helper:
      "Rules for ATS and site forms. BrighterMonday and MyJobMag use built-in field profiles; customize tone and overrides here.",
  },
];

const EMPTY_DRAFTS: Record<AgentTemplateType, string> = {
  job_matching: "",
  cover_letter: "",
  email_body: "",
  form_response: "",
};

function Templates() {
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const { data, isLoading: templatesLoading } = useQuery({
    queryKey: ["agent-templates"],
    queryFn: () => listAgentTemplates(),
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
  });

  const { data: authUser } = useQuery({
    queryKey: ["current_user_auth"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      return auth.user;
    },
  });

  const userDetails = useMemo(
    () => pickTemplateUserDetails(profileData?.profile, authUser?.email),
    [profileData?.profile, authUser?.email],
  );

  const defaultTemplates = useMemo(
    () => buildDefaultAgentTemplateContent(userDetails),
    [userDetails],
  );

  const [drafts, setDrafts] = useState<Record<AgentTemplateType, string>>({ ...EMPTY_DRAFTS });

  useEffect(() => {
    const next = { ...EMPTY_DRAFTS };
    for (const template of data?.templates ?? []) {
      const type = template.type as AgentTemplateType;
      if (type in next) {
        next[type] = template.content ?? "";
      }
    }
    setDrafts(next);
  }, [data]);

  const syncDraftsFromServer = () => {
    const next = { ...EMPTY_DRAFTS };
    for (const template of data?.templates ?? []) {
      const type = template.type as AgentTemplateType;
      if (type in next) {
        next[type] = template.content ?? "";
      }
    }
    setDrafts(next);
  };

  const handleCancel = () => {
    syncDraftsFromServer();
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const meta of TEMPLATE_META) {
        if (!next[meta.type]?.trim()) {
          next[meta.type] = defaultTemplates[meta.type];
        }
      }
      return next;
    });
    setIsEditing(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      await Promise.all(
        TEMPLATE_META.map((meta) =>
          saveAgentTemplate({
            type: meta.type,
            name: meta.name,
            content: drafts[meta.type].trim() || defaultTemplates[meta.type],
          }),
        ),
      );
    },
    onSuccess: () => {
      toast.success("Templates saved");
      qc.invalidateQueries({ queryKey: ["agent-templates"] });
      setIsEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (type: AgentTemplateType, value: string) => {
    setDrafts((prev) => ({ ...prev, [type]: value }));
  };

  const isLoading = templatesLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 sticky top-0 z-10 bg-background">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Agent templates
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                Instructions each AI agent uses when matching jobs and preparing applications.
                Saved only to your account — other users cannot see or change your templates.
              </p>
            </div>

            {!isEditing ? (
              <Button
                onClick={handleStartEdit}
                variant="outline"
                size="sm"
                className="h-10 sm:h-9 w-full sm:w-auto font-semibold text-xs sm:text-sm border-border/60"
              >
                <PenSquare className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Edit templates
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="h-10 sm:h-9 font-semibold text-xs sm:text-sm border-border/60"
                  disabled={saveMut.isPending}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                  className="h-10 sm:h-9 font-semibold text-xs sm:text-sm shadow-sm"
                >
                  {saveMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </div>

          {isEditing && (
            <p className="text-xs text-muted-foreground">
              Edit mode — changes apply after you save. Fields with no saved template show the
              default starter text.
            </p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 animate-in fade-in duration-300">
        <div className="divide-y divide-border/60">
          {TEMPLATE_META.map((meta) => {
            const savedContent = drafts[meta.type];
            const previewContent = resolveTemplateContent(meta.type, savedContent, userDetails);
            const isEmailBody = meta.type === "email_body";

            return (
              <section
                key={meta.type}
                className="py-5 sm:py-6 first:pt-0 space-y-3"
                aria-labelledby={`template-${meta.type}-heading`}
              >
                <div className="space-y-1">
                  <h2
                    id={`template-${meta.type}-heading`}
                    className="text-sm sm:text-base font-semibold text-foreground"
                  >
                    {meta.name}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">{meta.helper}</p>
                  {isEditing && meta.editHint && (
                    <p className="text-xs text-primary/90 leading-relaxed">{meta.editHint}</p>
                  )}
                </div>

                {!isEditing ? (
                  <div
                    className={cn(
                      "text-sm leading-relaxed whitespace-pre-wrap",
                      isEmailBody ? "text-foreground font-[family-name:var(--font-serif,Georgia,serif)]" : "text-foreground/90",
                    )}
                  >
                    {previewContent}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`template-${meta.type}`}
                      className="text-xs text-muted-foreground sr-only"
                    >
                      {meta.name} template
                    </Label>
                    <Textarea
                      id={`template-${meta.type}`}
                      value={
                        savedContent.trim()
                          ? savedContent
                          : defaultTemplates[meta.type]
                      }
                      onChange={(e) => set(meta.type, e.target.value)}
                      rows={isEmailBody ? 16 : meta.type === "cover_letter" ? 14 : 10}
                      className={cn(
                        "w-full border-border/80 text-sm leading-relaxed resize-y min-h-[200px]",
                        isEmailBody && "font-[family-name:var(--font-serif,Georgia,serif)]",
                        meta.type === "job_matching" || meta.type === "form_response"
                          ? "font-mono text-xs sm:text-sm"
                          : "",
                      )}
                    />
                    {isEmailBody && (
                      <p className="text-[11px] text-muted-foreground">
                        Prefilled with {userDetails.fullName}
                        {userDetails.email !== "your.email@example.com"
                          ? ` (${userDetails.email})`
                          : ""}
                        . Update your profile if these details change.
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
