// A JavaScript error that closes the app is written down first (on this phone
// only, never sent), so the next start can show what it was. Apple's crash
// reports only say "a JavaScript error"; this gives the message to report.
import { db, kvGet, kvSet } from "./db";

type Handler = (e: unknown, isFatal?: boolean) => void;
const EU = (globalThis as { ErrorUtils?: { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void } }).ErrorUtils;

export function installCrashNote() {
  if (!EU) return;
  const previous = EU.getGlobalHandler();
  EU.setGlobalHandler((e, isFatal) => {
    if (isFatal) {
      try {
        const err = e as { name?: string; message?: string; stack?: string };
        const note = `${err?.name || "Error"}: ${err?.message || String(e)}\n${String(err?.stack || "").split("\n").slice(0, 8).join("\n")}`;
        // Synchronous: the app is closed right after this handler.
        db.runSync("INSERT INTO kv (k, v) VALUES ('lastCrash', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", note.slice(0, 2000));
      } catch { /* the table may not exist yet on a first start */ }
    }
    previous(e, isFatal);
  });
}

/** The note from the last crash, once; null when there was none. */
export async function takeCrashNote(): Promise<string | null> {
  const note = await kvGet("lastCrash");
  if (note) await kvSet("lastCrash", null);
  return note;
}
