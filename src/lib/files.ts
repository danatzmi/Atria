export type FileKind = "image" | "video" | "note" | "document";

export function classifyMimeType(mimeType: string): FileKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("text/")) return "note";
  return "document";
}

// Short badge label for a document tile, e.g. "PDF", "DOCX", "XLSX" — the
// file extension reads more familiarly to users than a mime subtype.
// PDFs are the one document type we can render a real preview for (first
// page drawn to a canvas), so they need distinguishing from the generic
// "document" bucket. Checks the filename too — browsers sometimes upload a
// PDF as application/octet-stream.
export function isPdfFile(mimeType: string, name: string): boolean {
  return mimeType === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

export function getFormatLabel(mimeType: string, name: string): string {
  const ext = name.split(".").pop();
  if (ext && ext.length <= 5 && ext !== name) return ext.toUpperCase();
  const subtype = mimeType.split("/")[1];
  return subtype ? subtype.slice(0, 5).toUpperCase() : "FILE";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}
