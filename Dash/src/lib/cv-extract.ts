// Client-side CV text extraction (PDF + DOCX). Dynamic imports keep main bundle small.
export async function extractCvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    // @ts-expect-error - no types for browser bundle
    const mammoth = await import("mammoth/mammoth.browser");
    const buf = await file.arrayBuffer();
    const res = await (mammoth as any).extractRawText({ arrayBuffer: buf });
    return res.value as string;
  }
  if (name.endsWith(".pdf")) {
    const pdfjs: any = await import("pdfjs-dist");
    // Use the bundled worker URL
    const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n";
    }
    return text;
  }
  if (name.endsWith(".txt")) return await file.text();

  const isImage = name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
  if (isImage) {
    return "[Image File: Backend OCR will process]";
  }

  throw new Error("Unsupported file type. Upload PDF, DOCX, PNG, JPG, or TXT.");
}
