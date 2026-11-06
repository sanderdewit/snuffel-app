// AI voice conversation (beta): a live spoken conversation with a realtime AI
// model over WebRTC. Snuffel's /api/voice takes this phone's offer, sets up the
// session (instructions, voice) with Azure OpenAI in the EU and returns the
// answer; the app never holds a key. Audio then flows directly between the
// phone and Azure; the data channel only carries transcripts and speech events
// (the server asks for webrtcfilter=on), which the screen shows.
import { mediaDevices, MediaStream, RTCPeerConnection } from "react-native-webrtc";
import { CONFIG } from "./config";
import { betaCode } from "./beta";
import { ageMonths, type Dog } from "./dogs";
import { installId } from "./install";

export type VoiceState = "connecting" | "listening" | "thinking" | "speaking" | "ended";
export type VoiceEnd = "done" | "time" | "beta" | "rate_limited" | "unavailable" | "mic" | "failed";
export interface VoiceLine { role: "user" | "assistant"; text: string }

export interface VoiceHandlers {
  onState(s: VoiceState): void;
  onLines(lines: VoiceLine[]): void;      // the transcript so far
  onEnd(reason: VoiceEnd): void;          // once
}

export interface VoiceCall { hangUp(): void; maxSeconds: number }

/** Starts a conversation; resolves once connected (or ended, via onEnd). */
export async function startVoice(lang: string, labels: { emergency: string; lost: string }, dog: Dog | null, h: VoiceHandlers): Promise<VoiceCall | null> {
  let ended = false, timer: ReturnType<typeof setTimeout> | null = null;
  let pc: RTCPeerConnection | null = null, mic: MediaStream | null = null;
  const lines: VoiceLine[] = [];
  const end = (reason: VoiceEnd) => {
    if (ended) return;
    ended = true;
    if (timer) clearTimeout(timer);
    mic?.getTracks().forEach((t) => t.stop());
    try { pc?.close(); } catch { /* already closed */ }
    h.onState("ended");
    h.onEnd(reason);
  };

  h.onState("connecting");
  try {
    mic = await mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    end("mic");
    return null;
  }

  try {
    pc = new RTCPeerConnection();
    mic.getAudioTracks().forEach((t) => pc!.addTrack(t, mic!));   // the AI's voice arrives as a remote track and plays by itself
    const events = pc.createDataChannel("oai-events");
    events.addEventListener("message", (e: { data?: unknown }) => {
      let m: { type?: string; transcript?: string; delta?: string };
      try { m = JSON.parse(String(e.data)); } catch { return; }
      switch (m.type) {
        case "input_audio_buffer.speech_started": h.onState("listening"); break;
        case "input_audio_buffer.speech_stopped": h.onState("thinking"); break;
        case "output_audio_buffer.started": h.onState("speaking"); break;
        case "output_audio_buffer.stopped": h.onState("listening"); break;
        case "conversation.item.input_audio_transcription.completed":
          if (m.transcript?.trim()) { lines.push({ role: "user", text: m.transcript.trim() }); h.onLines([...lines]); }
          break;
        case "response.output_audio_transcript.delta": {
          const last = lines[lines.length - 1];
          if (last && last.role === "assistant" && !(last as { done?: boolean }).done) last.text += m.delta || "";
          else lines.push({ role: "assistant", text: m.delta || "" });
          h.onLines([...lines]);
          break;
        }
        case "response.output_audio_transcript.done": {
          const last = lines[lines.length - 1];
          if (last && last.role === "assistant") { if (m.transcript) last.text = m.transcript; (last as { done?: boolean }).done = true; }
          h.onLines([...lines]);
          break;
        }
      }
    });
    pc.addEventListener("connectionstatechange", () => {
      if (pc && (pc.connectionState === "failed" || pc.connectionState === "closed")) end(pc.connectionState === "failed" ? "failed" : "done");
    });

    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);

    const ctrl = new AbortController();
    const abort = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(CONFIG.voiceApi, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Snuffel-Install": await installId(), "X-Snuffel-Beta": (await betaCode()) || "" },
      body: JSON.stringify({
        sdp: offer.sdp, lang, emergencyLabel: labels.emergency, lostLabel: labels.lost,
        dog: dog ? { name: dog.name || undefined, breed: dog.breed || undefined, ageMonths: ageMonths(dog.birth) ?? undefined,
          weightKg: dog.weight ?? undefined, sex: dog.sex ?? undefined, neutered: dog.neutered ?? undefined } : undefined
      }),
      signal: ctrl.signal
    }).finally(() => clearTimeout(abort));
    if (r.status === 429) { end("rate_limited"); return null; }
    if (r.status === 403) {
      const d = await r.json().catch(() => null);
      end(d && d.error === "beta_required" ? "beta" : "failed");
      return null;
    }
    if (!r.ok) { end("failed"); return null; }
    const d = await r.json();
    if (!d.configured || typeof d.sdp !== "string") { end("unavailable"); return null; }
    await pc.setRemoteDescription({ type: "answer", sdp: d.sdp });

    const maxSeconds = Number(d.maxSeconds) > 0 ? Number(d.maxSeconds) : 600;
    timer = setTimeout(() => end("time"), maxSeconds * 1000);
    h.onState("listening");
    return { hangUp: () => end("done"), maxSeconds };
  } catch {
    end("failed");
    return null;
  }
}
