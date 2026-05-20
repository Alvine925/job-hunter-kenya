import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { saveCvAndExtract } from "@/lib/jobs.functions";
import { extractCvText } from "@/lib/cv-extract";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding/cv")({ component: OnboardCv });

function OnboardCv() {
  const navigate = useNavigate();
  const save = useServerFn(saveCvAndExtract);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "extract" | "upload" | "ai" | "done">("idle");

  const onUpload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      setStep("extract");
      const text = await extractCvText(file);
      if (text.trim().length < 30) throw new Error("Could not read text from this file. Try a different export.");

      setStep("upload");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("cvs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      setStep("ai");
      await save({ data: { storage_path: path, file_name: file.name, cv_text: text } });
      setStep("done");
      toast.success("CV parsed and profile pre-filled");
      navigate({ to: "/profile" });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setBusy(false); }
  };

  const labels: Record<string, string> = {
    extract: "Reading your CV…",
    upload: "Uploading securely…",
    ai: "AI is extracting your profile…",
    done: "Done",
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Upload your CV</h1>
      <p className="text-muted-foreground text-sm mb-6">PDF, DOCX, or TXT. We'll pre-fill your profile automatically.</p>

      <Card className="p-8">
        <label className="block border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:bg-muted/30 transition">
          <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 text-primary" />
              <div className="font-medium">{file.name}</div>
              <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · click to change</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="w-8 h-8" />
              <div className="font-medium">Click to choose your CV</div>
              <div className="text-xs">PDF, DOCX, or TXT — max 10 MB</div>
            </div>
          )}
        </label>

        {busy && (
          <div className="mt-4 text-sm flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> {labels[step] ?? "Working…"}
          </div>
        )}

        <Button className="w-full mt-6" disabled={!file || busy} onClick={onUpload}>
          {step === "done" ? <CheckCircle2 className="w-4 h-4 mr-2" /> : null}
          Upload & analyze
        </Button>
      </Card>

      <button onClick={() => navigate({ to: "/profile" })} className="mt-4 text-sm text-muted-foreground hover:text-foreground block mx-auto">
        Skip for now — I'll fill my profile manually
      </button>
    </div>
  );
}
