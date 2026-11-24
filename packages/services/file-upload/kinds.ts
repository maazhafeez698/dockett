export type FileKind = "pdf" | "docx" | "jpg" | "png";

export const FILE_KINDS: Record<
  FileKind,
  { label: string; mime: string; extensions: string[] }
> = {
  pdf: { label: "PDF", mime: "application/pdf", extensions: ["pdf"] },
  docx: {
    label: "DOCX",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
  },
  jpg: { label: "JPEG", mime: "image/jpeg", extensions: ["jpg", "jpeg"] },
  png: { label: "PNG", mime: "image/png", extensions: ["png"] },
};

export const ALL_FILE_KINDS = Object.keys(FILE_KINDS) as FileKind[];

export function isFileKind(v: unknown): v is FileKind {
  return typeof v === "string" && (ALL_FILE_KINDS as string[]).includes(v);
}

export function describeKinds(kinds: readonly FileKind[]): string {
  return kinds.map((k) => FILE_KINDS[k].label).join(", ");
}

/** Extension of a filename mapped to a kind. Only the LAST extension counts ("a.pdf.exe" → null). */
export function kindFromFilename(name: string): FileKind | null {
  const base = name.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  for (const kind of ALL_FILE_KINDS) {
    if (FILE_KINDS[kind].extensions.includes(ext)) return kind;
  }
  return null;
}

// Some browsers/OSes report nothing, or a generic type, for perfectly valid files (notably DOCX).
// A missing/generic MIME is tolerated here because the byte check below is what actually decides.
const GENERIC_MIMES = new Set(["", "application/octet-stream", "application/zip", "application/x-zip-compressed"]);

export function mimeCompatible(kind: FileKind, mime: string): boolean {
  const m = mime.trim().toLowerCase();
  if (m === FILE_KINDS[kind].mime) return true;
  if (kind === "jpg" && m === "image/jpg") return true;
  if (kind === "docx" && GENERIC_MIMES.has(m)) return true;
  return m === "" || m === "application/octet-stream";
}

const ascii = (bytes: Uint8Array, from: number, to: number) => {
  let out = "";
  for (let i = from; i < Math.min(to, bytes.length); i++) out += String.fromCharCode(bytes[i]!);
  return out;
};

/** What the first bytes of a file say it is (null = not one of our allowed kinds). */
export function sniffKind(head: Uint8Array): FileKind | null {
  if (head.length < 4) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";

  // PDF: "%PDF-" within the first 1024 bytes (the spec tolerates leading junk).
  if (ascii(head, 0, 1024).includes("%PDF-")) return "pdf";

  // DOCX: a ZIP ("PK\x03\x04") whose first entries are OOXML parts.
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    const text = ascii(head, 0, 8192);
    if (text.includes("[Content_Types].xml") || text.includes("word/")) return "docx";
  }

  return null;
}

/** Display-only name: no path, no control/markup characters, bounded length. Never used as a key. */
export function sanitizeDisplayName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").normalize("NFKC");
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const trimmed = cleaned.length > 120 ? cleaned.slice(-120) : cleaned;
  return trimmed.replace(/^\.+/, "") || "file";
}
