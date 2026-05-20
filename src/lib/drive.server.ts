// Google Drive helpers via Lovable connector gateway (server-only)
const GW = "https://connector-gateway.lovable.dev/google_drive";

function headers() {
  const lov = process.env.LOVABLE_API_KEY;
  const gd = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY missing");
  if (!gd) throw new Error("GOOGLE_DRIVE_API_KEY missing");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": gd };
}

export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const h = headers();
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ""}`;
  const listRes = await fetch(`${GW}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, { headers: h });
  if (!listRes.ok) throw new Error(`Drive list ${listRes.status}: ${await listRes.text()}`);
  const list = await listRes.json();
  if (list.files?.[0]) return list.files[0].id;

  const createRes = await fetch(`${GW}/drive/v3/files`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!createRes.ok) throw new Error(`Drive create folder ${createRes.status}: ${await createRes.text()}`);
  return (await createRes.json()).id;
}

export async function uploadTextFile(name: string, content: string, folderId: string): Promise<{ id: string; webViewLink: string }> {
  const h = headers();
  const boundary = "----lovable" + Math.random().toString(36).slice(2);
  const metadata = { name, parents: [folderId], mimeType: "text/plain" };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${GW}/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: { ...h, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return { id: d.id, webViewLink: d.webViewLink || `https://drive.google.com/file/d/${d.id}/view` };
}
