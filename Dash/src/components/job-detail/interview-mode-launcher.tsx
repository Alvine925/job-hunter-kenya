import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateInterviewReport,
  loadInterviewState,
  resetInterviewQuiz,
  startInterviewQuiz,
  submitInterviewAnswer,
  type InterviewReport,
} from "@/lib/api";
import {
  ensureSpeechVoicesLoaded,
  getSpeechRecognitionCtor,
  isVoiceModeSupported,
  speakAloud,
  stopSpeaking,
  unlockSpeechOnUserGesture,
  type SpeechRecognitionInstance,
} from "@/lib/speech";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ClipboardList,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InterviewReportSection } from "./interview-report-section";

type InputMode = "chat" | "voice" | null;
type Phase = "pick_mode" | "quiz" | "report";

type InterviewMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  jobId: string;
  jobTitle: string;
  company?: string | null;
  hasPrepQuestions: boolean;
  placement?: "default" | "aside";
  sheetOpenFromUrl?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
  onReportGenerated?: () => void;
  hideLauncher?: boolean;
};

export function InterviewModeLauncher({
  jobId,
  jobTitle,
  company,
  hasPrepQuestions,
  placement = "default",
  sheetOpenFromUrl = false,
  onSheetOpenChange,
  onReportGenerated,
  hideLauncher = false,
}: Props) {
  const isAside = placement === "aside";
  const [panelOpen, setPanelOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("pick_mode");
  const [inputMode, setInputMode] = useState<InputMode>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [recruiterName, setRecruiterName] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /** Browser blocked auto-play — user must tap to hear the recruiter. */
  const [needsListenTap, setNeedsListenTap] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoListenAfterSpeakRef = useRef(false);
  const lastSpokenRef = useRef<string | null>(null);
  const qc = useQueryClient();

  const speechSupported = isVoiceModeSupported();

  const setPanelOpenAndNotify = useCallback(
    (next: boolean) => {
      setPanelOpen(next);
      onSheetOpenChange?.(next);
    },
    [onSheetOpenChange],
  );

  const { data: loaded, isLoading, refetch } = useQuery({
    queryKey: ["interview-quiz", jobId],
    queryFn: () => loadInterviewState(jobId),
    enabled: panelOpen || sheetOpenFromUrl,
    staleTime: 10_000,
  });

  useEffect(() => {
    setPanelOpen(sheetOpenFromUrl);
  }, [sheetOpenFromUrl]);

  useEffect(() => {
    void ensureSpeechVoicesLoaded();
  }, []);

  const mapMessages = (rows: { role: string; content: string; id?: string }[]): InterviewMessage[] =>
    rows
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }));

  const syncFromServer = useCallback((data: typeof loaded) => {
    if (!data) return;
    if (data.report) {
      setReport(data.report);
      setPhase("report");
      return;
    }
    if (data.session?.status === "in_progress" && data.messages?.length) {
      setInputMode(data.session.mode);
      setPhase("quiz");
      setRecruiterName(data.recruiter_name ?? data.session.recruiter_name ?? null);
      setMessages(mapMessages(data.messages ?? []));
      setPanelOpen(true);
      return;
    }
    if (data.session?.status === "complete" && !data.report) {
      setPhase("quiz");
      setInputMode(data.session.mode);
      setMessages(mapMessages(data.messages ?? []));
      setPanelOpen(true);
      return;
    }
    setPhase("pick_mode");
    setInputMode(null);
    setMessages([]);
    setRecruiterName(null);
    setLastFeedback(null);
  }, []);

  useEffect(() => {
    syncFromServer(loaded);
  }, [loaded, syncFromServer]);

  const speakText = useCallback(
    async (text: string, mode: InputMode, autoListenAfter = false) => {
      if (mode !== "voice" || !text.trim()) return false;
      autoListenAfterSpeakRef.current = autoListenAfter;
      lastSpokenRef.current = text;
      setNeedsListenTap(false);

      const ok = await speakAloud(text, {
        onStart: () => setSpeaking(true),
        onEnd: () => {
          setSpeaking(false);
          if (autoListenAfterSpeakRef.current) {
            autoListenAfterSpeakRef.current = false;
            queueMicrotask(() => startListeningRef.current?.());
          }
        },
        onBlocked: () => {
          setSpeaking(false);
          setNeedsListenTap(true);
          toast.message("Tap “Listen to recruiter” to hear them speak", {
            description: "Your browser requires a tap before playing voice.",
          });
        },
      });

      if (!ok) setNeedsListenTap(true);
      return ok;
    },
    [],
  );

  const playRecruiterAudio = useCallback(
    (autoListenAfter = false) => {
      unlockSpeechOnUserGesture();
      const text =
        lastSpokenRef.current ??
        [...messages].reverse().find((m) => m.role === "assistant")?.content;
      if (text) void speakText(text, "voice", autoListenAfter);
    },
    [messages, speakText],
  );

  const startListeningRef = useRef<(() => void) | null>(null);

  const reportMut = useMutation({
    mutationFn: () => generateInterviewReport(jobId),
    onSuccess: (res) => {
      setReport(res.report);
      setPhase("report");
      stopSpeaking();
      toast.success("Performance report ready");
      qc.invalidateQueries({ queryKey: ["interview-quiz", jobId] });
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      onReportGenerated?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: (answer: string) => submitInterviewAnswer({ jobId, answer }),
    onSuccess: (res) => {
      if (res.scored?.feedback) {
        setLastFeedback({ score: res.scored.score, feedback: res.scored.feedback });
      }
      setMessages(mapMessages(res.messages ?? []));
      const last = res.message?.content ?? res.messages?.[res.messages.length - 1]?.content;
      if (last && res.session.mode === "voice") {
        void speakText(last, "voice", !res.interview_complete);
      }
      if (res.interview_complete) {
        toast.success("Interview complete!", {
          description: "Click 'Close Interview & Generate Report' to view your performance report.",
        });
      }
      qc.invalidateQueries({ queryKey: ["interview-quiz", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startMut = useMutation({
    mutationFn: (mode: "chat" | "voice") => startInterviewQuiz({ jobId, mode }),
    onSuccess: (res) => {
      const mode = res.session.mode;
      setInputMode(mode);
      setPhase("quiz");
      setRecruiterName(res.recruiter_name);
      setMessages(mapMessages(res.messages ?? []));
      setLastFeedback(null);
      setReport(null);
      setPanelOpen(true);
      const opening = res.messages?.[0]?.content ?? res.opening_message?.content;
      if (opening && mode === "voice") {
        lastSpokenRef.current = opening;
        setNeedsListenTap(true);
        void speakText(opening, "voice", true).then((ok) => {
          if (ok) setNeedsListenTap(false);
        });
      }
      qc.invalidateQueries({ queryKey: ["interview-quiz", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startVoiceInterview = () => {
    unlockSpeechOnUserGesture();
    void ensureSpeechVoicesLoaded();
    setNeedsListenTap(false);
    startMut.mutate("voice");
  };

  const resetMut = useMutation({
    mutationFn: () => resetInterviewQuiz(jobId),
    onSuccess: () => {
      stopSpeaking();
      recognitionRef.current?.stop();
      setPhase("pick_mode");
      setInputMode(null);
      setMessages([]);
      setRecruiterName(null);
      setLastFeedback(null);
      setReport(null);
      refetch();
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendAnswer = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        toast.error("Type or say your answer first.");
        return;
      }
      if (submitMut.isPending || reportMut.isPending) return;
      stopSpeaking();
      recognitionRef.current?.stop();
      setListening(false);
      setChatInput("");
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      submitMut.mutate(trimmed);
    },
    [submitMut, reportMut.isPending],
  );

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      toast.error("Voice input needs Chrome or Edge.");
      return;
    }
    if (listening || submitMut.isPending || speaking) return;
    stopSpeaking();

    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-KE";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error("Could not hear you. Tap the mic and try again.");
    };
    rec.onresult = (event) => {
      const results = event.results;
      let transcript = "";
      for (let i = 0; i < results.length; i++) {
        transcript += results[i]?.[0]?.transcript ?? "";
      }
      transcript = transcript.trim();
      const last = results[results.length - 1] as { isFinal?: boolean } | undefined;
      if (transcript && last?.isFinal) {
        sendAnswer(transcript);
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      toast.error("Microphone unavailable. Allow mic access for this site.");
    }
  }, [listening, submitMut.isPending, speaking, sendAnswer]);

  startListeningRef.current = startListening;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lastFeedback, messages, phase, reportMut.isPending, speaking, listening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  const busy = startMut.isPending || submitMut.isPending || reportMut.isPending || resetMut.isPending;

  const openPanel = () => {
    if (!hasPrepQuestions) return;
    setPanelOpenAndNotify(true);
  };

  const sessionBody = (
    <>
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4 space-y-4",
        )}
      >
        {isLoading && (
          <div className="flex justify-center py-12 text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        )}

        {phase === "pick_mode" && !isLoading && (
          <div className="space-y-4 py-2">
            {startMut.isPending ? (
              <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span>Starting chat interview...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Mock interview with a named recruiter — chat to answer role-specific questions and get a detailed performance report.
                </p>
                <Button
                  className="w-full h-11 gap-2"
                  onClick={() => startMut.mutate("chat")}
                  disabled={busy}
                >
                  <MessageSquare className="w-4 h-4" />
                  Start chat interview
                </Button>
              </div>
            )}
          </div>
        )}

        {phase === "quiz" && !isLoading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
              <span className="min-w-0 truncate">
                {inputMode === "chat" ? "Chat mode" : "Voice mode"}
                {recruiterName ? ` · ${recruiterName}` : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => resetMut.mutate()}
                disabled={busy}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Restart
              </Button>
            </div>

            {inputMode === "voice" && (
              <div className="space-y-2">
                {(needsListenTap || startMut.isPending) && (
                  <Button
                    type="button"
                    className="w-full h-11"
                    variant="default"
                    disabled={speaking || startMut.isPending}
                    onClick={() => playRecruiterAudio(true)}
                  >
                    <Volume2 className="w-5 h-5 mr-2" />
                    {startMut.isPending
                      ? "Starting voice interview…"
                      : `Listen to ${recruiterName ?? "recruiter"}`}
                  </Button>
                )}
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm flex items-center gap-3",
                    speaking ? "border-primary/40 bg-primary/5" : "bg-muted/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      speaking ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <Volume2 className={cn("w-4 h-4", speaking && "animate-pulse")} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-xs">
                      {speaking
                        ? `${recruiterName ?? "Recruiter"} is speaking — listen…`
                        : listening
                          ? "Your turn — speak now"
                          : needsListenTap
                            ? "Tap the button above to hear the introduction"
                            : "Recruiter will speak, then you answer with the mic"}
                    </p>
                    {!speaking && !listening && !needsListenTap && lastSpokenRef.current && (
                      <button
                        type="button"
                        className="text-xs text-primary mt-0.5 hover:underline"
                        onClick={() => playRecruiterAudio(false)}
                      >
                        Hear again
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {lastFeedback?.feedback && (
              <div className="border-l-2 border-primary/50 pl-3.5 py-1 text-sm space-y-1 my-3">
                <p className="font-medium text-primary">Feedback: {lastFeedback.score}/100</p>
                <p className="text-foreground/80 leading-relaxed">{lastFeedback.feedback}</p>
              </div>
            )}

            <div className="flex flex-col gap-6">
              {messages.map((m, i) => (
                <div
                  key={m.id ?? i}
                  className={cn(
                    "text-sm leading-relaxed max-w-[88%] break-words flex flex-col",
                    m.role === "assistant"
                      ? "self-start items-start text-left"
                      : "self-end items-end text-left",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-bold tracking-wider uppercase mb-1.5",
                      m.role === "assistant" ? "text-primary/90" : "text-muted-foreground/80",
                    )}
                  >
                    {m.role === "assistant" ? (recruiterName || "Recruiter") : "You"}
                  </span>
                  <p
                    className={cn(
                      "whitespace-pre-wrap",
                      m.role === "assistant"
                        ? "text-foreground/90"
                        : "text-primary font-medium",
                    )}
                  >
                    {m.content}
                  </p>
                </div>
              ))}

              {submitMut.isPending && (
                <div className="self-start items-start flex flex-col">
                  <span className="text-[10px] font-bold tracking-wider uppercase mb-1.5 text-primary/90">
                    {recruiterName || "Recruiter"}
                  </span>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm pl-0.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span className="italic">typing…</span>
                  </div>
                </div>
              )}
            </div>

            {reportMut.isPending && (
              <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                Building your performance report…
              </div>
            )}
          </div>
        )}

        {phase === "report" && report && (
          <InterviewReportSection reportRaw={JSON.stringify(report)} />
        )}
      </div>

      {phase === "quiz" && (
        <div className="shrink-0 p-3 sm:p-4 border-t bg-background space-y-3">
          {loaded?.session?.status === "complete" ? (
            <Button
              className="w-full h-11 gap-2"
              onClick={() => reportMut.mutate()}
              disabled={busy}
            >
              {reportMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ClipboardList className="w-4 h-4" />
              )}
              {reportMut.isPending ? "Generating report…" : "Close Interview & Generate Report"}
            </Button>
          ) : (
            <>
              {inputMode === "chat" ? (
                <form
                  className="flex items-end gap-2 min-w-0"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendAnswer(chatInput);
                  }}
                >
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (chatInput.trim() && !busy) {
                          sendAnswer(chatInput);
                        }
                      }
                    }}
                    placeholder="Type your response…"
                    disabled={busy}
                    className="text-sm min-w-0 flex-1 min-h-[44px] max-h-32 resize-none py-3 px-3.5"
                    rows={1}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    disabled={busy || !chatInput.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <Button
                    type="button"
                    className="w-full h-12 text-base"
                    variant={listening ? "destructive" : "default"}
                    onClick={listening ? () => recognitionRef.current?.stop() : startListening}
                    disabled={busy || speaking}
                  >
                    {listening ? (
                      <>
                        <MicOff className="w-5 h-5 mr-2 animate-pulse" />
                        Stop listening
                      </>
                    ) : speaking ? (
                      <>
                        <Volume2 className="w-5 h-5 mr-2" />
                        Wait for recruiter…
                      </>
                    ) : (
                      <>
                        <Mic className="w-5 h-5 mr-2" />
                        Tap to speak your answer
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                    Turn up volume. Allow microphone when asked. Flow: recruiter speaks → you tap mic →
                    you speak → recruiter responds by voice.
                  </p>
                </>
              )}

              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-9 text-xs gap-1.5 border-dashed border-primary/40 hover:border-primary text-primary hover:bg-primary/5"
                  onClick={() => reportMut.mutate()}
                  disabled={busy}
                >
                  {reportMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ClipboardList className="w-3.5 h-3.5" />
                  )}
                  Finish Interview & Generate Report
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {phase === "report" && (
        <div className="shrink-0 p-3 sm:p-4 border-t flex flex-col sm:flex-row gap-2 bg-background">
          <Button
            className="flex-1 h-11 sm:h-10"
            variant="outline"
            onClick={() => resetMut.mutate()}
            disabled={busy}
          >
            Practice again
          </Button>
          {!isAside && (
            <Button className="flex-1 h-11 sm:h-10" onClick={() => setPanelOpenAndNotify(false)}>
              Done
            </Button>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {!hideLauncher && (
        <div
          className={cn(
            "rounded-lg border bg-muted/30 min-w-0",
            isAside
              ? "flex flex-col gap-3 p-3 sm:p-4"
              : "flex flex-col sm:flex-row sm:items-center gap-3 p-4",
          )}
        >
          <div className="min-w-0 flex-1">
            <Label className="text-sm font-medium">Mock interview</Label>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Realistic interview with a named recruiter — chat or voice, then a scored report.
            </p>
          </div>
          <Button
            type="button"
            variant={isAside ? "default" : "outline"}
            size="sm"
            className={cn(isAside && "w-full h-11 sm:h-9")}
            onClick={openPanel}
            disabled={!hasPrepQuestions}
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            {panelOpen && phase !== "pick_mode" ? "Interview in progress" : "Start mock interview"}
          </Button>
        </div>
      )}

      {!hideLauncher && !hasPrepQuestions && (
        <p className={cn("text-xs text-muted-foreground", isAside ? "" : "-mt-2")}>
          Draft practice questions on the left first — the interview uses those topics.
        </p>
      )}

      <Sheet open={panelOpen} onOpenChange={setPanelOpenAndNotify}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col gap-0 p-0 h-full max-h-[100dvh]"
        >
          <SheetHeader className="shrink-0 px-5 pt-5 pb-4 border-b text-left">
            <SheetTitle className="text-base">Mock interview</SheetTitle>
            <SheetDescription className="text-sm">
              {jobTitle}
              {company ? ` · ${company}` : ""}
            </SheetDescription>
          </SheetHeader>
          {sessionBody}
        </SheetContent>
      </Sheet>
    </>
  );
}
