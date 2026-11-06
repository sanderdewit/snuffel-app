// Beta features, unlocked with a code in Settings. For now: the AI voice
// conversation (a live spoken conversation with a realtime AI model; the chat
// and the phone-based voice in it are for everyone). The code is checked by the
// server (/api/beta) and sent when a conversation starts (header X-Snuffel-Beta),
// so it only works while it is in the server's BETA_CODES; the app keeps it on
// the phone, nothing else.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CONFIG } from "./config";
import { kvGet, kvSet } from "./db";
import { installId } from "./install";

export type JoinResult = "ok" | "wrong" | "rate_limited" | "failed";

/** Asks the server whether a code is valid; stores it when it is. */
async function checkCode(code: string): Promise<JoinResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(CONFIG.betaApi, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Snuffel-Install": await installId() },
      body: JSON.stringify({ code }),
      signal: ctrl.signal
    });
    if (r.status === 429) return "rate_limited";
    if (!r.ok) return "failed";
    const d = await r.json();
    return d && d.ok === true ? "ok" : "wrong";
  } catch {
    return "failed";
  } finally { clearTimeout(timer); }
}

/** The stored code, for starting a voice conversation (null when not in the beta). */
export const betaCode = (): Promise<string | null> => kvGet("betaCode");

interface Beta {
  ready: boolean;
  joined: boolean;          // a valid code was entered
  voiceOn: boolean;         // the AI voice switch in Settings
  voice: boolean;           // AI voice conversation available: joined and switched on
  join(code: string): Promise<JoinResult>;
  leave(): Promise<void>;   // also used when the server no longer accepts the code
  setVoiceOn(on: boolean): Promise<void>;
}

const Ctx = createContext<Beta | null>(null);

export function BetaProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [voiceOn, setVoiceOnState] = useState(false);

  useEffect(() => {
    Promise.all([kvGet("betaCode"), kvGet("betaVoice")])
      .then(([code, on]) => { setJoined(!!code); setVoiceOnState(on === "1"); })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const join = useCallback(async (raw: string) => {
    const code = raw.trim().slice(0, 64);
    if (!code) return "wrong" as const;
    const r = await checkCode(code);
    if (r === "ok") {
      await kvSet("betaCode", code);
      await kvSet("betaVoice", "1");       // joining is asking for it: switched on right away
      setJoined(true); setVoiceOnState(true);
    }
    return r;
  }, []);
  const leave = useCallback(async () => {
    await kvSet("betaCode", null);
    await kvSet("betaVoice", null);
    setJoined(false); setVoiceOnState(false);
  }, []);
  const setVoiceOn = useCallback(async (on: boolean) => {
    await kvSet("betaVoice", on ? "1" : null);
    setVoiceOnState(on);
  }, []);

  const value = useMemo<Beta>(() => ({ ready, joined, voiceOn, voice: joined && voiceOn, join, leave, setVoiceOn }),
    [ready, joined, voiceOn, join, leave, setVoiceOn]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBeta(): Beta {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBeta outside BetaProvider");
  return v;
}
