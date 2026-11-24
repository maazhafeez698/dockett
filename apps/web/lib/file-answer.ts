export const BUSY_PREFIX = "~uploading~";

export function encodeFileAnswer(ids: string[], busy: boolean): string {
  const json = ids.length > 0 ? JSON.stringify(ids) : "";
  return busy ? BUSY_PREFIX + json : json;
}

export function parseFileAnswer(value: string): { ids: string[]; busy: boolean } {
  const busy = value.startsWith(BUSY_PREFIX);
  const raw = busy ? value.slice(BUSY_PREFIX.length) : value;
  if (!raw.trim()) return { ids: [], busy };
  try {
    const parsed = JSON.parse(raw) as unknown;
    const ids = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    return { ids, busy };
  } catch {
    return { ids: [], busy };
  }
}

export const isUploading = (value: string | undefined) => !!value && value.startsWith(BUSY_PREFIX);

// File references as stored in a submission (written by the server). 
export interface StoredFileRef {
  id: string;
  name: string;
  size: number;
  kind: string;
}

export function parseStoredFiles(value: string): StoredFileRef[] {
  if (!value.trim().startsWith("[")) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is StoredFileRef =>
        !!r && typeof r === "object" && typeof (r as StoredFileRef).id === "string" && typeof (r as StoredFileRef).name === "string",
    );
  } catch {
    return [];
  }
}

export function formatBytes(b: number): string {
  if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MB";
  return Math.max(1, Math.round(b / 1024)) + " KB";
}
