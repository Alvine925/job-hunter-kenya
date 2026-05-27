const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

function b64url(input: string): string {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function uint8ToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

export interface SendMailParams {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  cc?: string;
  bcc?: string;
  accessToken: string;
  attachment?: { filename: string; mimeType: string; data: Uint8Array };
  attachments?: { filename: string; mimeType: string; data: Uint8Array }[];
}

function sanitizeHeader(val: string): string {
  return val.replace(/[\r\n]+/g, "").trim();
}

function cleanHeaderEmailList(val: string): string {
  const sanitized = val.replace(/[\r\n]+/g, "").trim();
  const emails = sanitized.split(",").map(e => e.trim());
  const validEmails = emails.filter(e => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(e);
  });
  if (validEmails.length === 0) {
    throw new Error(`Invalid email address: "${val}"`);
  }
  return validEmails.join(", ");
}

export async function sendGmail(p: SendMailParams): Promise<{ id: string; threadId: string }> {
  const cleanTo = cleanHeaderEmailList(p.to);
  const cleanCc = p.cc ? cleanHeaderEmailList(p.cc) : undefined;
  const cleanBcc = p.bcc ? cleanHeaderEmailList(p.bcc) : undefined;
  const cleanSubject = sanitizeHeader(p.subject);

  const boundary = "----edge" + crypto.randomUUID().replace(/-/g, "");
  const lines: string[] = [];
  lines.push(`To: ${cleanTo}`);
  if (cleanCc) lines.push(`Cc: ${cleanCc}`);
  if (cleanBcc) lines.push(`Bcc: ${cleanBcc}`);
  lines.push(`Subject: ${cleanSubject}`);
  lines.push("MIME-Version: 1.0");

  const attachments = p.attachments ?? (p.attachment ? [p.attachment] : []);

  let raw: string;
  if (attachments.length > 0) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(p.body);
    lines.push("");

    for (const attach of attachments) {
      lines.push(`--${boundary}`);
      lines.push(
        `Content-Type: ${attach.mimeType}; name="${attach.filename}"`
      );
      lines.push("Content-Transfer-Encoding: base64");
      lines.push(
        `Content-Disposition: attachment; filename="${attach.filename}"`
      );
      lines.push("");
      const b64 = uint8ToBase64(attach.data);
      // Split into 76-char lines
      const b64Lines = b64.match(/.{1,76}/g) || [b64];
      lines.push(b64Lines.join("\r\n"));
    }
    lines.push(`--${boundary}--`);
    raw = lines.join("\r\n");
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("");
    lines.push(p.body);
    raw = lines.join("\r\n");
  }

  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: b64url(raw) }),
  });
  if (!res.ok) throw new Error(`Gmail send ${res.status}: ${await res.text()}`);
  return res.json();
}
