// Turn uploaded flyer files (PDFs and/or photos) into small JPEG pages, in the
// browser, before anything goes over the wire. A Lidl PDF is ~45 MB — far past
// Gemini's 20 MB inline limit — but its pages rendered at ~1600px are a few
// hundred KB each, and Gemini bills an image by tiles, not bytes, so this costs
// no extra tokens and reads just as well. Each page is then OCR'd in its own
// /api/ocr-page request, same as the auto-fetched flyers.

// Grocery deals are front-loaded; matches VISION_MAX_PAGES on the server.
export const UPLOAD_MAX_PAGES = 10;
const MAX_EDGE = 1600;
const QUALITY = 0.8;

export interface PageImage { mime: string; data: string }

const toJpeg = (canvas: HTMLCanvasElement): PageImage => ({
  mime: "image/jpeg",
  data: canvas.toDataURL("image/jpeg", QUALITY).split(",")[1],
});

async function imagePage(file: File): Promise<PageImage> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return toJpeg(canvas);
}

async function* pdfPages(file: File, limit: number): AsyncGenerator<PageImage> {
  // Lazy-load pdf.js so the ~1 MB library only ships when someone uploads a PDF.
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    for (let n = 1; n <= Math.min(doc.numPages, limit); n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: MAX_EDGE / Math.max(base.width, base.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; // JPEG has no alpha — transparent areas would go black
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();
      yield toJpeg(canvas);
    }
  } finally {
    await doc.destroy();
  }
}

// Yields pages one at a time so the caller can OCR as they render (and memory
// holds only one rendered page at a time).
export async function* uploadedPages(files: File[], limit = UPLOAD_MAX_PAGES): AsyncGenerator<PageImage> {
  let n = 0;
  for (const f of files) {
    if (n >= limit) return;
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      for await (const p of pdfPages(f, limit - n)) { n++; yield p; }
    } else {
      n++; yield await imagePage(f);
    }
  }
}
