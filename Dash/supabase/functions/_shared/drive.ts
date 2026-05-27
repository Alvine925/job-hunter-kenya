import { coverLetterToDocSegments, type DocSegment } from "./document-format.ts";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const DOCS_API = "https://docs.googleapis.com/v1/documents";

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function findOrCreateFolder(
  name: string,
  accessToken: string,
  parentId?: string
): Promise<string> {
  const h = authHeaders(accessToken);
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ""}`;
  const listRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: h }
  );
  if (!listRes.ok) throw new Error(`Drive list ${listRes.status}: ${await listRes.text()}`);
  const list = await listRes.json();
  if (list.files?.[0]) return list.files[0].id;

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!createRes.ok)
    throw new Error(`Drive create folder ${createRes.status}: ${await createRes.text()}`);
  return (await createRes.json()).id;
}

export async function uploadTextFile(
  name: string,
  content: string,
  folderId: string,
  accessToken: string
): Promise<{ id: string; webViewLink: string }> {
  const h = authHeaders(accessToken);
  const boundary = "----edge" + crypto.randomUUID().replace(/-/g, "");
  const metadata = { name, parents: [folderId], mimeType: "text/plain" };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        ...h,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return {
    id: d.id,
    webViewLink:
      d.webViewLink || `https://drive.google.com/file/d/${d.id}/view`,
  };
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export async function uploadBinaryFile(
  name: string,
  data: Uint8Array,
  mimeType: string,
  folderId: string,
  accessToken: string,
): Promise<{ id: string; webViewLink: string }> {
  const h = authHeaders(accessToken);
  const boundary = "----edge" + crypto.randomUUID().replace(/-/g, "");
  const metadata = { name, parents: [folderId], mimeType };
  const enc = new TextEncoder();
  const preamble = enc.encode(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n`,
  );
  const closing = enc.encode(`\r\n--${boundary}--`);
  const body = concatBytes(preamble, data, closing);

  const res = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        ...h,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive binary upload ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return {
    id: d.id,
    webViewLink: d.webViewLink || `https://drive.google.com/file/d/${d.id}/view`,
  };
}

function buildDocsBatchRequests(segments: DocSegment[]): { requests: unknown[]; length: number } {
  const requests: unknown[] = [];
  let index = 1;

  for (const seg of segments) {
    if (!seg.text) continue;
    requests.push({
      insertText: { location: { index }, text: seg.text },
    });
    requests.push({
      updateTextStyle: {
        range: { startIndex: index, endIndex: index + seg.text.length },
        textStyle: { bold: seg.bold },
        fields: "bold",
      },
    });
    index += seg.text.length;
  }

  return { requests, length: index };
}

/** Google Doc with bold section titles (Docs API + documents scope). */
export async function createGoogleDocFormatted(
  name: string,
  content: string,
  folderId: string,
  accessToken: string,
): Promise<{ id: string; webViewLink: string }> {
  const h = authHeaders(accessToken);
  const docName = name.replace(/\.(txt|doc|docx)$/i, "").trim() || "Cover Letter";
  const segments = coverLetterToDocSegments(content);

  const createRes = await fetch(DOCS_API, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ title: docName }),
  });
  if (!createRes.ok) {
    throw new Error(`Google Doc create ${createRes.status}: ${await createRes.text()}`);
  }
  const { documentId } = await createRes.json();
  if (!documentId) throw new Error("Google Doc create returned no documentId");

  const { requests } = buildDocsBatchRequests(segments);
  if (requests.length > 0) {
    const batchRes = await fetch(`${DOCS_API}/${documentId}:batchUpdate`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });
    if (!batchRes.ok) {
      throw new Error(`Google Doc format ${batchRes.status}: ${await batchRes.text()}`);
    }
  }

  await fetch(`${DRIVE_API}/files/${documentId}?addParents=${folderId}&fields=id`, {
    method: "PATCH",
    headers: h,
  });

  return {
    id: documentId,
    webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

/** Create a native Google Doc from plain text (uses Drive convert + documents scope). */
export async function createGoogleDocFromText(
  name: string,
  content: string,
  folderId: string,
  accessToken: string,
): Promise<{ id: string; webViewLink: string }> {
  const h = authHeaders(accessToken);
  const boundary = "----edge" + crypto.randomUUID().replace(/-/g, "");
  const docName = name.replace(/\.(txt|doc|docx)$/i, "").trim() || "Cover Letter";
  const metadata = {
    name: docName,
    parents: [folderId],
    mimeType: "application/vnd.google-apps.document",
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        ...h,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Google Doc create ${res.status}: ${await res.text()}`);
  }
  const d = await res.json();
  return {
    id: d.id,
    webViewLink:
      d.webViewLink || `https://docs.google.com/document/d/${d.id}/edit`,
  };
}
