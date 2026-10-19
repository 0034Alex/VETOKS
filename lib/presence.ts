// «В сети» / «был(а) недавно». Точное время никому не отдаём — только грубое состояние.
export type PresenceState = "online" | "recent" | "long" | "";

export function presenceState(lastSeen: string | null | undefined, privacy: unknown): PresenceState {
  const priv = ((privacy ?? {}) as Record<string, boolean>) || {};
  if (priv.online === false) return ""; // человек скрыл — ничего не показываем
  if (!lastSeen) return "";
  const ms = Date.now() - new Date(lastSeen).getTime();
  if (ms < 5 * 60 * 1000) return "online";
  if (ms < 24 * 3600 * 1000) return "recent";
  return "long";
}
