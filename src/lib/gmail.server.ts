// Gmail send via Lovable connector gateway (server-only)
const GW = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function headers() {
  const lov = process.env.LOVABLE_API_KEY;
  const gm = process.env.GOOGLE_MAIL_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY missing");
  if (!gm) throw new Error("GOOGLE_MAIL_API_KEY missing — connect Gmail in connectors");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": gm };
}

function b64url(input: string | Uint8Array): string {
  const b64 = typeof input === "string"
    ? Buffer.from(input, "utf8").toString("base64")
    : Buffer.from(input).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface SendMailParams {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  cc?: string;
  bcc?: string;
  attachment?: { filename: string; mimeType: string; data: Uint8Array };
}

export async function sendGmail(p: SendMailParams): Promise<{ id: string; threadId: string }> {
  const boundary = "----lov" + Math.random().toString(36).slice(2);
  const lines: string[] = [];
  lines.push(`To: ${p.to}`);
  if (p.cc) lines.push(`Cc: ${p.cc}`);
  if (p.bcc) lines.push(`Bcc: ${p.bcc}`);
  lines.push(`Subject: ${p.subject}`);
  lines.push("MIME-Version: 1.0");

  let raw: string;
  if (p.attachment) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(p.body);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${p.attachment.mimeType}; name="${p.attachment.filename}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename="${p.attachment.filename}"`);
    lines.push("");
    // base64 in 76-char lines
    const b64 = Buffer.from(p.attachment.data).toString("base64").replace(/(.{76})/g, "$1\r\n");
    lines.push(b64);
    lines.push(`--${boundary}--`);
    raw = lines.join("\r\n");
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("");
    lines.push(p.body);
    raw = lines.join("\r\n");
  }

  const res = await fetch(`${GW}/users/me/messages/send`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64url(raw) }),
  });
  if (!res.ok) throw new Error(`Gmail send ${res.status}: ${await res.text()}`);
  return res.json();
}
