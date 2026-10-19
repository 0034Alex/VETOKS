import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FileKind = "image" | "video" | "unknown";

// Определяем настоящий тип файла по первым байтам, а не по расширению и не по тому, что заявил браузер.
export function sniffKind(b: Uint8Array): FileKind {
  const at = (i: number) => b[i] ?? 0;
  const ascii = (from: number, s: string) => s.split("").every((c, i) => at(from + i) === c.charCodeAt(0));
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image"; // JPEG
  if (at(0) === 0x89 && ascii(1, "PNG")) return "image";
  if (ascii(0, "GIF8")) return "image";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image";
  if (ascii(4, "ftyp")) {
    const brand = String.fromCharCode(at(8), at(9), at(10), at(11));
    if (/^(heic|heix|hevc|mif1|msf1|avif)/.test(brand)) return "image";
    return "video"; // mp4 / mov
  }
  if (at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3) return "video"; // webm
  return "unknown";
}

// Скачиваем только начало файла по ссылке нашего хранилища.
export async function sniffUrl(url: string): Promise<FileKind | "unreachable"> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { headers: { Range: "bytes=0-31" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return "unreachable";
    const buf = new Uint8Array((await r.arrayBuffer()).slice(0, 32));
    return sniffKind(buf);
  } catch {
    return "unreachable";
  }
}

// Ссылка вида <supabase>/storage/v1/object/public/<bucket>/<имя> → {bucket, name}.
export function parseStorageUrl(url: string): { bucket: string; name: string } | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const prefix = `${base}/storage/v1/object/public/`;
  if (!base || !url.startsWith(prefix)) return null;
  const [bucket, ...rest] = url.slice(prefix.length).split("?")[0].split("/");
  const name = decodeURIComponent(rest.join("/"));
  return bucket && name ? { bucket, name } : null;
}

// Проверяем файл по ссылке; если внутри не то, что нужно — удаляем из хранилища.
export async function verifyStoredFile(url: string, want: "image" | "video" | "any"): Promise<boolean> {
  const k = await sniffUrl(url);
  if (k === "unreachable") return true; // файла нет или хранилище не ответило — подделать нечем
  const ok = k === "image" ? want !== "video" : k === "video" ? want !== "image" : false;
  if (!ok) {
    const p = parseStorageUrl(url);
    if (p) await supabaseAdmin.storage.from(p.bucket).remove([p.name]);
  }
  return ok;
}
