export type FileKind = "image" | "video" | "note" | "document";

export function classifyMimeType(mimeType: string): FileKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("text/")) return "note";
  return "document";
}

// Short badge label for a document tile, e.g. "PDF", "DOCX", "XLSX" — the
// file extension reads more familiarly to users than a mime subtype.
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
