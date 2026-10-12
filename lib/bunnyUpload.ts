// Загрузка файла прямо из браузера в Bunny по протоколу TUS (по кускам, с процентами).
// Ключ Bunny сюда не попадает — только одноразовая подпись с сервера.

type Auth = { videoId: string; libraryId: string; signature: string; expire: number };

const ENDPOINT = "https://video.bunnycdn.com/tusupload";
const CHUNK = 6 * 1024 * 1024;

function b64(s: string) {
  return btoa(unescape(encodeURIComponent(s)));
}

export async function bunnyUpload(
  file: File,
  auth: Auth,
  onProgress: (pct: number) => void
): Promise<void> {
  const authHeaders: Record<string, string> = {
    AuthorizationSignature: auth.signature,
    AuthorizationExpire: String(auth.expire),
    VideoId: auth.videoId,
    LibraryId: auth.libraryId,
  };

  const create = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file.size),
      "Upload-Metadata": `filetype ${b64(file.type || "video/mp4")},title ${b64("video")}`,
    },
  });
  if (!create.ok) throw new Error("Не удалось начать загрузку");
  let location = create.headers.get("Location");
  if (!location) throw new Error("Сервер видео не ответил");
  if (location.startsWith("/")) location = "https://video.bunnycdn.com" + location;

  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK, file.size);
    const blob = file.slice(offset, end);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PATCH", location!);
      Object.entries(authHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.setRequestHeader("Tus-Resumable", "1.0.0");
      xhr.setRequestHeader("Upload-Offset", String(offset));
      xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round(((offset + e.loaded) / file.size) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Сбой загрузки")));
      xhr.onerror = () => reject(new Error("Нет связи — попробуйте ещё раз"));
      xhr.send(blob);
    });
    offset = end;
    onProgress(Math.round((offset / file.size) * 100));
  }
}

// Длина ролика в секундах (0 — если телефон не смог прочитать).
export function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(file);
    const done = (n: number) => {
      URL.revokeObjectURL(url);
      resolve(n);
    };
    v.onloadedmetadata = () => done(isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    v.src = url;
  });
}
