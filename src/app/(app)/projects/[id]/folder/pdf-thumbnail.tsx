"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// PDF.js does its parsing in a web worker. Resolving it with
// `new URL(..., import.meta.url)` lets the bundler emit the worker as a real
// asset and hand back a correct hashed URL — the alternative, pointing
// workerSrc at a CDN, would break the app whenever that CDN is unreachable
// and quietly ships a third-party script into a private binder.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Renders page 1 of a PDF onto a canvas.
//
// Canvas rather than <iframe>/<object> because Android's WebView refuses to
// render PDFs inline and turns them into a download prompt instead — the
// whole point here is that a designer sees the drawing without opening it.
// Text and annotation layers are switched off: this is a picture of a page,
// never something to select or click through, and they cost DOM and CSS.
export function PdfThumbnail({ url, width }: { url: string; width: number }) {
  const [failed, setFailed] = useState(false);

  // A PDF that won't parse (corrupt, password-protected, or a signed URL
  // that expired mid-render) must not take the card down with it — the
  // caller shows its generic badge instead.
  if (failed) return null;

  return (
    <Document
      file={url}
      onLoadError={() => setFailed(true)}
      onSourceError={() => setFailed(true)}
      loading={<div className="h-full w-full animate-pulse bg-stone-100" />}
      error={<div className="h-full w-full bg-stone-50" />}
      className="flex h-full w-full items-start justify-center overflow-hidden"
    >
      <Page
        pageNumber={1}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={<div className="h-full w-full animate-pulse bg-stone-100" />}
        error={<div className="h-full w-full bg-stone-50" />}
      />
    </Document>
  );
}
