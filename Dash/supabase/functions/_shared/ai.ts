const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Extract and parse JSON from model output; repairs common formatting issues. */
export function parseAiJsonContent<T>(raw: string): T {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  else {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
  }

  // Normalize smart/curly quotes to straight quotes before any parsing
  text = text.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  const stripped = text.replace(/,\s*([}\]])/g, "$1");

  const attempts: string[] = [
    text,
    stripped,
    sanitizeJsonStrings(text),
    sanitizeJsonStrings(stripped),
    repairUnescapedQuotes(text),
    repairUnescapedQuotes(stripped),
  ];

  let lastError: unknown;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new SyntaxError("Could not parse AI JSON");
}

/**
 * Walk through JSON character by character, escaping raw newlines, tabs,
 * and other control characters that appear inside string values.
 */
function sanitizeJsonStrings(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (escaped) {
      out += c;
      escaped = false;
      continue;
    }
    if (c === "\\") {
      out += c;
      escaped = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      out += c;
      continue;
    }
    if (inString) {
      if (c === "\r") continue;
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
      // Escape any other control characters (0x00–0x1F)
      const code = c.charCodeAt(0);
      if (code < 0x20) {
        out += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
    }
    out += c;
  }
  return out;
}

/**
 * Aggressive repair for unescaped double quotes inside JSON string values.
 * The error "Expected ',' or '}' after property value" almost always means
 * the model wrote something like:  "apply for the "Senior Engineer" role"
 * This function walks the JSON and escapes interior quotes that aren't at
 * a valid JSON structural boundary.
 */
function repairUnescapedQuotes(json: string): string {
  // First apply basic control char sanitization
  const clean = sanitizeJsonStrings(json);

  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (escaped) {
      out += c;
      escaped = false;
      continue;
    }
    if (c === "\\") {
      out += c;
      escaped = true;
      continue;
    }
    if (c === '"') {
      if (!inString) {
        // Opening a string
        inString = true;
        out += c;
        continue;
      }
      // We're inside a string and hit a quote — is this the real closing quote?
      // Look ahead: after a valid closing quote we expect optional whitespace
      // then one of: , } ] :  (structural JSON characters)
      const after = clean.slice(i + 1).trimStart();
      const nextChar = after[0];
      if (
        nextChar === undefined ||
        nextChar === "," ||
        nextChar === "}" ||
        nextChar === "]" ||
        nextChar === ":"
      ) {
        // This is the real closing quote
        inString = false;
        out += c;
      } else {
        // Interior quote — escape it
        out += '\\"';
      }
      continue;
    }
    out += c;
  }
  return out;
}

/** Dedicated Gemini key only (not Vision — that key cannot call generateContent). */
function hasDirectGemini(): boolean {
  return !!(Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY"));
}

async function callDirectGeminiJsonRaw(prompt: string, system?: string): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  if (!key) {
    throw new Error(
      "No GEMINI_API_KEY/GOOGLE_API_KEY configured. Use LOVABLE_API_KEY or add a Gemini API key.",
    );
  }
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${system ? system + "\n\n" : ""}User Prompt:\n${prompt}` }],
      }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    throw new Error(`Direct Gemini API failed with status ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function callDirectGeminiJson<T>(prompt: string, system?: string): Promise<T> {
  const text = await callDirectGeminiJsonRaw(prompt, system);
  return parseAiJsonContent<T>(text);
}

async function callDirectGeminiText(prompt: string, system?: string): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  if (!key) throw new Error("No GEMINI_API_KEY/GOOGLE_API_KEY configured.");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${system ? system + "\n\n" : ""}User Prompt:\n${prompt}` }],
      }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Direct Gemini API failed with status ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

const JSON_RETRY_SUFFIX =
  "\n\nCRITICAL: Return ONE valid JSON object only. No markdown. Use | between list items. No raw newlines inside JSON strings.";

async function callLovableGatewayRaw(
  prompt: string,
  system: string | undefined,
  model: string,
): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not set");

  console.log("AI: Lovable gateway (ai.gateway.lovable.dev)");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Lovable AI ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}

async function callLovableJson<T>(
  prompt: string,
  system?: string,
  model = "google/gemini-2.5-flash",
): Promise<T> {
  let lastError: unknown;
  for (const suffix of ["", JSON_RETRY_SUFFIX]) {
    try {
      const raw = await callLovableGatewayRaw(prompt + suffix, system, model);
      return parseAiJsonContent<T>(raw);
    } catch (e) {
      lastError = e;
      console.warn("Lovable JSON attempt failed:", e);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Lovable API returned invalid JSON after retries");
}

export async function aiJsonViaGemini<T = unknown>(
  prompt: string,
  system?: string,
): Promise<T> {
  const sys = system ??
    "Output one JSON object only. Use | between list items. No newlines inside JSON strings.";
  try {
    return parseAiJsonContent<T>(await callDirectGeminiJsonRaw(prompt, sys));
  } catch (err) {
    console.warn("Gemini JSON parse failed, retrying:", err);
    return parseAiJsonContent<T>(
      await callDirectGeminiJsonRaw(prompt + JSON_RETRY_SUFFIX, sys),
    );
  }
}

function hasCloudflareAi(): boolean {
  return !!(Deno.env.get("CLOUDFLARE_ACCOUNT_ID") && Deno.env.get("CLOUDFLARE_API_TOKEN"));
}

async function callCloudflareAi(
  prompt: string,
  system?: string,
  isJson = false,
): Promise<string> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const configuredModel = Deno.env.get("CLOUDFLARE_AI_MODEL") || "@cf/meta/llama-3.1-8b-instruct";

  if (!accountId || !token) {
    throw new Error("Cloudflare configuration is incomplete.");
  }

  const messages = [];
  if (system) {
    messages.push({ role: "system", content: system });
  }
  const finalPrompt = isJson
    ? `${prompt}\n\nCRITICAL: Return ONE valid JSON object only. No markdown formatting, no code fences, no extra text, just the raw JSON.`
    : prompt;
    
  messages.push({ role: "user", content: finalPrompt });

  const modelsToTry = [configuredModel];
  const fallbackMistral = "@cf/mistral/mistral-7b-instruct-v0.2";
  if (configuredModel !== fallbackMistral) {
    modelsToTry.push(fallbackMistral);
  }

  let lastError: unknown;
  for (const model of modelsToTry) {
    try {
      console.log(`AI: Attempting Cloudflare Workers AI with model ${model}...`);
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Workers AI returned status ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(`Workers AI returned success=false: ${JSON.stringify(data.errors)}`);
      }

      const responseText = data.result?.response ?? "";
      if (responseText) {
        return responseText;
      }
    } catch (e) {
      console.warn(`Cloudflare model ${model} execution failed, trying fallback:`, e);
      lastError = e;
    }
  }

  throw lastError instanceof Error 
    ? lastError 
    : new Error("All Cloudflare Workers AI model attempts failed.");
}

async function callCloudflareJson<T>(prompt: string, system?: string): Promise<T> {
  const raw = await callCloudflareAi(prompt, system, true);
  return parseAiJsonContent<T>(raw);
}

export async function aiJson<T = unknown>(
  prompt: string,
  system?: string,
  model = "google/gemini-2.5-flash",
): Promise<T> {
  const sys = system ??
    "Output strict JSON only. Use | between list items. No newlines inside JSON strings.";

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (lovableKey) {
    try {
      return await callLovableJson<T>(prompt, sys, model);
    } catch (lovableErr) {
      console.warn("Lovable failed, using Gemini fallback:", lovableErr);
    }
  }

  if (hasDirectGemini()) {
    try {
      console.log("AI: Using Direct Gemini fallback");
      return await callDirectGeminiJson<T>(prompt, sys);
    } catch (geminiErr) {
      console.warn("Direct Gemini failed, using Cloudflare fallback:", geminiErr);
    }
  }

  if (hasCloudflareAi()) {
    try {
      console.log("AI: Using Cloudflare Workers AI fallback");
      return await callCloudflareJson<T>(prompt, sys);
    } catch (cfErr) {
      console.error("Cloudflare Workers AI failed:", cfErr);
      throw new Error(`All AI JSON providers failed. Lovable, Gemini, and Cloudflare failed. CF Error: ${cfErr instanceof Error ? cfErr.message : String(cfErr)}`);
    }
  }

  throw new Error("No LOVABLE_API_KEY, GEMINI_API_KEY/GOOGLE_API_KEY, or CLOUDFLARE credentials configured for AI.");
}

export async function aiText(
  prompt: string,
  system?: string,
  model = "google/gemini-2.5-flash",
): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (lovableKey) {
    try {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Lovable AI ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    } catch (lovableErr) {
      console.warn("Lovable text failed, Gemini fallback:", lovableErr);
    }
  }

  if (hasDirectGemini()) {
    try {
      console.log("AI: Using Direct Gemini text fallback");
      return await callDirectGeminiText(prompt, system);
    } catch (geminiErr) {
      console.warn("Direct Gemini text failed, Cloudflare fallback:", geminiErr);
    }
  }

  if (hasCloudflareAi()) {
    try {
      console.log("AI: Using Cloudflare Workers AI text fallback");
      return await callCloudflareAi(prompt, system, false);
    } catch (cfErr) {
      console.error("Cloudflare Workers AI text failed:", cfErr);
      throw new Error(`All AI text providers failed. Lovable, Gemini, and Cloudflare failed. CF Error: ${cfErr instanceof Error ? cfErr.message : String(cfErr)}`);
    }
  }

  throw new Error("No LOVABLE_API_KEY, GEMINI_API_KEY/GOOGLE_API_KEY, or CLOUDFLARE credentials configured for AI.");
}
