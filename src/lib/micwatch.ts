// The microphone during an AI voice conversation, judged from the connection's own
// statistics (RTCPeerConnection.getStats). While the microphone works, the captured
// audio (media-source totalSamplesDuration) and the audio packets sent (outbound-rtp
// packetsSent) keep growing, also in silence. When neither grows, the phone sends
// nothing: the AI greets and then waits for ever, and the screen says "Listening…".
// That happened on an iPhone when a call was started right after another one.
// It can also send audio that is silence throughout (the level bars stay empty while
// the owner talks): quietWatch catches that from the level.

export interface MicSample {
  samples?: number;   // seconds of audio captured so far
  packets?: number;   // audio packets sent so far
  level?: number;     // the microphone's current level, 0-1 (linear, as WebRTC reports it)
  energy?: number;    // total audio energy captured so far
}

type Stat = { type?: string; kind?: string; mediaType?: string; totalSamplesDuration?: unknown; packetsSent?: unknown; audioLevel?: unknown; totalAudioEnergy?: unknown };

/** The audio numbers from one getStats() report (a Map of stats objects). */
export function micSample(report: { forEach(cb: (r: Stat) => void): void }): MicSample {
  const s: MicSample = {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  report.forEach((r) => {
    if (!r || (r.kind ?? r.mediaType) !== "audio") return;
    if (r.type === "media-source") {
      const d = num(r.totalSamplesDuration), l = num(r.audioLevel), en = num(r.totalAudioEnergy);
      if (d !== undefined) s.samples = (s.samples ?? 0) + d;
      if (l !== undefined) s.level = Math.max(s.level ?? 0, l);
      if (en !== undefined) s.energy = (s.energy ?? 0) + en;
    } else if (r.type === "outbound-rtp") {
      const p = num(r.packetsSent);
      if (p !== undefined) s.packets = (s.packets ?? 0) + p;
    }
  });
  return s;
}

/** Bars to light (0-bars) for a level: -50 dB and below is none, -10 dB and above is all. */
export function levelBars(level: number | undefined, bars = 5): number {
  if (!level || level <= 0) return 0;
  const db = 20 * Math.log10(level);
  return Math.max(0, Math.min(bars, Math.round(((db + 50) / 40) * bars)));
}

/**
 * Watches the samples of a connected call. "dead": neither number grew for deadMs.
 * Samples without any number never count (the statistics may be missing), and a
 * reset (after the recording was restarted) starts the clock again.
 */
export function micWatch(deadMs: number) {
  let last: MicSample | null = null;
  let since = 0;
  return {
    check(s: MicSample, now: number): "ok" | "dead" {
      if (s.samples === undefined && s.packets === undefined) return "ok";
      if (!last) { last = s; since = now; return "ok"; }
      const grew = (s.samples !== undefined && last.samples !== undefined && s.samples > last.samples)
        || (s.packets !== undefined && last.packets !== undefined && s.packets > last.packets);
      last = s;
      if (grew) { since = now; return "ok"; }
      return now - since >= deadMs ? "dead" : "ok";
    },
    reset() { last = null; }
  };
}

/** Below this level (about -66 dB) the microphone hears practically nothing: a working one picks up the room. */
export const QUIET_LEVEL = 0.0005;

/**
 * Watches the level of a connected call. "quiet": every sample for quietMs stayed
 * below QUIET_LEVEL, i.e. silence, also while the owner talks. Samples without a
 * level never count; reset starts the clock again.
 */
export function quietWatch(quietMs: number, floor = QUIET_LEVEL) {
  let since: number | null = null, loudest = 0;
  return {
    check(s: MicSample, now: number): "ok" | "quiet" {
      if (s.level === undefined) return "ok";
      loudest = Math.max(loudest, s.level);
      if (s.level >= floor) { since = null; return "ok"; }
      if (since === null) since = now;
      return now - since >= quietMs ? "quiet" : "ok";
    },
    reset() { since = null; },
    loudest: () => loudest
  };
}
