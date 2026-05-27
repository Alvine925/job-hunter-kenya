/** Browser speech helpers for mock interview voice mode. */

export type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { results: { length: number; [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceModeSupported(): boolean {
  return !!getSpeechRecognitionCtor() && typeof window !== "undefined" && "speechSynthesis" in window;
}

let voicesReady = false;
let resumeInterval: ReturnType<typeof setInterval> | null = null;

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => /en-GB|en-KE/i.test(v.lang)) ??
    voices.find((v) => /en-US/i.test(v.lang)) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    voices[0]
  );
}

/** Chrome loads voices asynchronously. */
export function ensureSpeechVoicesLoaded(): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  const synth = window.speechSynthesis;
  if (voicesReady && synth.getVoices().length > 0) return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => {
      voicesReady = synth.getVoices().length > 0;
      resolve();
    };
    synth.onvoiceschanged = done;
    done();
    setTimeout(done, 400);
  });
}

/**
 * Call synchronously inside a click handler so later async speech is allowed.
 * Browsers block TTS that starts only after a network round-trip.
 */
export function unlockSpeechOnUserGesture(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();
  const prime = new SpeechSynthesisUtterance(" ");
  prime.volume = 0.01;
  prime.rate = 2;
  synth.speak(prime);
}

function clearResumeInterval() {
  if (resumeInterval) {
    clearInterval(resumeInterval);
    resumeInterval = null;
  }
}

function startResumeInterval() {
  clearResumeInterval();
  resumeInterval = setInterval(() => {
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.resume();
    }
  }, 120);
}

/** Split long recruiter replies — Chrome often drops very long single utterances. */
function chunkTextForSpeech(text: string, maxLen = 220): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];

  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  for (const sentence of sentences) {
    const next = buf ? `${buf} ${sentence}` : sentence;
    if (next.length <= maxLen) {
      buf = next;
    } else {
      if (buf) chunks.push(buf);
      if (sentence.length <= maxLen) {
        buf = sentence;
      } else {
        for (let i = 0; i < sentence.length; i += maxLen) {
          chunks.push(sentence.slice(i, i + maxLen));
        }
        buf = "";
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [trimmed];
}

function speakOneChunk(
  text: string,
  voice: SpeechSynthesisVoice | undefined,
  onChunkStart?: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9;
    utter.pitch = 1;
    utter.lang = "en-KE";
    if (voice) utter.voice = voice;

    utter.onstart = () => onChunkStart?.();
    utter.onend = () => resolve();
    utter.onerror = () => reject(new Error("speech-error"));

    synth.speak(utter);
  });
}

export type SpeakAloudOptions = {
  onStart?: () => void;
  onEnd?: () => void;
  onBlocked?: () => void;
};

/**
 * Speak text aloud. Returns true if audio actually started.
 * Must call unlockSpeechOnUserGesture() on the same click that starts voice mode.
 */
export async function speakAloud(text: string, options?: SpeakAloudOptions): Promise<boolean> {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) {
    return false;
  }

  await ensureSpeechVoicesLoaded();

  const synth = window.speechSynthesis;
  synth.cancel();
  clearResumeInterval();

  const voice = pickVoice();
  const chunks = chunkTextForSpeech(text);

  let audioStarted = false;
  const startTimeout = window.setTimeout(() => {
    if (!audioStarted) {
      synth.cancel();
      options?.onBlocked?.();
    }
  }, 900);

  const onFirstSound = () => {
    if (audioStarted) return;
    audioStarted = true;
    window.clearTimeout(startTimeout);
    options?.onStart?.();
    startResumeInterval();
  };

  try {
    for (let i = 0; i < chunks.length; i++) {
      await speakOneChunk(chunks[i], voice, i === 0 ? onFirstSound : undefined);
    }
    return audioStarted;
  } catch {
    window.clearTimeout(startTimeout);
    if (!audioStarted) options?.onBlocked?.();
    return false;
  } finally {
    clearResumeInterval();
    options?.onEnd?.();
  }
}

export function stopSpeaking(): void {
  clearResumeInterval();
  window.speechSynthesis?.cancel();
}
