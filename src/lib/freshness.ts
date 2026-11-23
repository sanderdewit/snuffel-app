// When the app looks for a new version of the place data (places/manifest.json).
// The data is rebuilt every month and after fixes, and the website reads the newest
// version on every visit. The app used to look at most once a day, and while it
// stayed in memory (iOS keeps an app suspended for days) never again, so a phone
// could show last week's places while the website had today's.
// Now: at the first search, again when the app comes back to the front, and at most
// every CHECK_MS, sending the stored ETag so an unchanged manifest costs only a 304.
// A search never waits long for the check when a stored copy exists: in an emergency
// yesterday's data now is better than today's data after a slow network.
// Pure (no React Native), so tests/freshness.test.ts can run it in Node.

export interface Stored<T> { at: number; v: T; etag?: string | null }
export interface Fetched<T> { status: number; etag: string | null; value?: T }

export interface CheckDeps<T> {
  load: () => Promise<Stored<T> | null>;
  save: (s: Stored<T>) => Promise<void>;
  /** GET with If-None-Match when `etag` is given; `value` is the parsed body for a 2xx answer. */
  fetch: (etag: string | null) => Promise<Fetched<T>>;
  now: () => number;
  /** A new manifest arrived from the network (`previous`: what was used before, if anything). */
  onNew?: (value: T, previous: T | null) => void;
  /** After every check: whether the network answered. */
  onOnline?: (online: boolean) => void;
  wait?: (ms: number) => Promise<void>;
  checkMs?: number;
  retryMs?: number;
  waitMs?: number;
}

export const CHECK_MS = 15 * 60 * 1000;   // look again after 15 minutes at the earliest
export const RETRY_MS = 60 * 1000;        // after a failed check (offline), after a minute
export const WAIT_MS = 2500;              // how long a search waits for a check when a stored copy exists

export function versionCheck<T>(d: CheckDeps<T>) {
  const checkMs = d.checkMs ?? CHECK_MS, retryMs = d.retryMs ?? RETRY_MS, waitMs = d.waitMs ?? WAIT_MS;
  const wait = d.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let current: T | null = null, etag: string | null = null, loaded: Promise<void> | null = null;
  let nextAt = 0, running: Promise<T | null> | null = null;

  const load = () => loaded ??= d.load().catch(() => null).then((s) => {
    if (s && current == null) { current = s.v; etag = s.etag ?? null; }
  });

  function check(): Promise<T | null> {
    running ??= (async () => {
      try {
        const r = await d.fetch(current != null ? etag : null);
        if (r.status === 304 && current != null) {
          // unchanged
        } else if (r.status >= 200 && r.status < 300 && r.value != null) {
          const previous = current;
          current = r.value; etag = r.etag;
          await d.save({ at: d.now(), v: r.value, etag: r.etag }).catch(() => undefined);
          d.onNew?.(r.value, previous);
        } else throw new Error("manifest " + r.status);
        nextAt = d.now() + checkMs;
        d.onOnline?.(true);
      } catch {
        nextAt = d.now() + retryMs;
        d.onOnline?.(false);
      }
      return current;
    })().finally(() => { running = null; });
    return running;
  }

  /** The manifest to use now: the one in memory while it is fresh, else after a (short) look at the network. */
  async function get(): Promise<T | null> {
    await load();
    if (current != null && d.now() < nextAt) return current;
    const checked = check();
    if (current == null) return checked;   // nothing stored yet: wait for the network
    const stored = current;
    return Promise.race([checked.then((v) => v ?? stored), wait(waitMs).then(() => current ?? stored)]);
  }

  /** Starts a check in the background when one is due (the app came back to the front). */
  function refreshIfDue(): void {
    if (!running && d.now() >= nextAt) get().catch(() => undefined);
  }

  return { get, refreshIfDue };
}
